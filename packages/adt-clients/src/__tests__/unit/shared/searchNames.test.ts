/**
 * The search filter takes the release's search names (interfaces-adt
 * 24.0.0, `ADT_SEARCH_TYPES_*`), not a code.
 *
 * On S/4HANA 2025 and ABAP cloud a name selects what the object types list
 * says — `DEVC` the packages, `STRU` only `TABL/DS` — while a code that is no
 * list item's `type` selects as the text before its `/` and an unknown one
 * answers nothing, silently (measured 2026-10-29). On SAP_BASIS 7.40, which
 * has no list, the aliases answer nothing, so `STRU` is no 7.40 name.
 *
 * The request is the one the library always sent: the name as the
 * `objectType` parameter. Each variant sends it for a name it takes; a code,
 * an unknown name, and a name another variant alone takes do not compile.
 */
import type { AdtVariant } from '@mcp-abap-adt/interfaces-adt';
import type { AdtModernVariant } from '../../../clients/variant';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

type R = typeof utilDocuments;

function utilsOf<V extends AdtVariant>(): {
  connection: RecordingConnection;
  utils: AdtUtils<R, V>;
} {
  const connection = new RecordingConnection();
  return {
    connection,
    utils: new AdtUtils<R, V>(connection, {
      logger: noopLogger,
      results: utilDocuments,
    }),
  };
}

const SEARCH =
  '/sap/bc/adt/repository/informationsystem/search?operation=quickSearch';

describe('search: the filter is a search name of the variant', () => {
  it.each([
    ['onprem', 'DEVC'],
    ['onprem', 'STRU'],
    ['cloud', 'DEVC'],
    ['cloud', 'STRU'],
  ] as const)('%s sends %s as objectType', async (variant, name) => {
    const { connection, utils } =
      variant === 'onprem' ? utilsOf<'onprem'>() : utilsOf<'cloud'>();
    await utils.search({ query: 'Z*', objectType: name, maxResults: 5 });
    expect(connection.sent.map((request) => request.url)).toEqual([
      `${SEARCH}&query=Z*&maxResults=5&objectType=${name}`,
    ]);
    expect(connection.sent[0]?.method).toBe('GET');
    expect(connection.sent[0]?.headers).toEqual({ Accept: 'application/xml' });
  });

  it('the modern default sends a name both lists hold', async () => {
    const { connection, utils } = utilsOf<AdtModernVariant>();
    await utils.search({ query: 'Z*', objectType: 'DEVC', maxResults: 5 });
    expect(connection.sent.map((request) => request.url)).toEqual([
      `${SEARCH}&query=Z*&maxResults=5&objectType=DEVC`,
    ]);
  });

  it('7.40 sends a name measured to select there', async () => {
    const { connection, utils } = utilsOf<'basis740'>();
    await utils.search({ query: 'Z*', objectType: 'DEVC', maxResults: 5 });
    expect(connection.sent.map((request) => request.url)).toEqual([
      `${SEARCH}&query=Z*&maxResults=5&objectType=DEVC`,
    ]);
  });

  it('a search without a filter sends none', async () => {
    const { connection, utils } = utilsOf<'onprem'>();
    await utils.search({ query: 'Z*' });
    expect(connection.sent.map((request) => request.url)).toEqual([
      `${SEARCH}&query=Z*&maxResults=100`,
    ]);
  });
});

/** What the filter refuses, per variant. Type-level: never called. */
async function filterChecks(
  onprem: AdtUtils<R, 'onprem'>,
  cloud: AdtUtils<R, 'cloud'>,
  modern: AdtUtils<R, AdtModernVariant>,
  basis740: AdtUtils<R, 'basis740'>,
): Promise<void> {
  // A code is no filter value: `TABL/DS` is `STRU`'s item type, but the
  // filter takes the name.
  // @ts-expect-error -- a code, not a search name
  await onprem.search({ query: 'Z*', objectType: 'TABL/DS' });
  // @ts-expect-error -- a code, not a search name
  await cloud.search({ query: 'Z*', objectType: 'TABL/DS' });
  // @ts-expect-error -- a code, not a search name
  await modern.search({ query: 'Z*', objectType: 'TABL/DS' });
  // @ts-expect-error -- a code, not a search name
  await basis740.search({ query: 'Z*', objectType: 'TABL/DS' });

  // An unknown name: `400` on the newer releases, no hits on 7.40.
  // @ts-expect-error -- no list holds `NOPE`
  await onprem.search({ query: 'Z*', objectType: 'NOPE' });
  // @ts-expect-error -- no list holds `NOPE`
  await basis740.search({ query: 'Z*', objectType: 'NOPE' });

  // An alias selects on the newer releases and answers nothing on 7.40.
  await onprem.search({ query: 'Z*', objectType: 'STRU' });
  await modern.search({ query: 'Z*', objectType: 'STRU' });
  // @ts-expect-error -- `STRU` answers no hits on 7.40: no name there
  await basis740.search({ query: 'Z*', objectType: 'STRU' });
}

it('holds the compile checks above', () => {
  // Type-level: what matters is that this file compiles.
  expect(typeof filterChecks).toBe('function');
});
