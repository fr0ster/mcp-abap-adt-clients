/**
 * Where a reference leads: one `POST /sap/bc/adt/navigation/target` with the
 * reference as the `uri` query value, no body. Measured on premise and on the
 * ABAP cloud (2026-11-28): an outline's name fragment
 * (`…/source/main#type=PROG%2FPU;name=…`) answers `200` with an
 * `adtcore:objectReference` whose `uri` ends `#start=line,column`.
 */

import type {
  IAdtNavigationTargetReadable,
  IAdtObjectOutlineReadable,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

const FRAGMENT =
  '/sap/bc/adt/programs/programs/zprog/source/main#type=PROG%2FPU;name=SOME%20FORM';

function utils(connection: RecordingConnection): AdtUtils {
  return new AdtUtils(connection, {
    logger: noopLogger,
    results: utilDocuments,
  });
}

describe('getNavigationTarget', () => {
  it('sends one POST with the reference as the uri value, encoded once, and no body', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getNavigationTarget(FRAGMENT);
    expect(connection.sent).toHaveLength(1);
    const [request] = connection.sent;
    expect(request?.method).toBe('POST');
    const url = new URL(request?.url ?? '', 'http://adt.invalid');
    expect(url.pathname).toBe('/sap/bc/adt/navigation/target');
    // Decoded once, the query gives back the reference exactly as it came.
    expect([...url.searchParams.entries()]).toEqual([['uri', FRAGMENT]]);
    expect(request?.data).toBeUndefined();
    expect(request?.timeout).toBe(0);
  });

  it.each([
    [
      { filter: 'f' },
      [
        ['uri', FRAGMENT],
        ['filter', 'f'],
      ],
    ],
    [
      { fullname: 'n' },
      [
        ['uri', FRAGMENT],
        ['fullname', 'n'],
      ],
    ],
    [
      { filter: 'f', fullname: 'n' },
      [
        ['uri', FRAGMENT],
        ['filter', 'f'],
        ['fullname', 'n'],
      ],
    ],
  ])(
    'adds the template parameter %o and nothing else',
    async (options, query) => {
      const connection = new RecordingConnection();
      await utils(connection).getNavigationTarget(FRAGMENT, options);
      const url = new URL(connection.sent[0]?.url ?? '', 'http://adt.invalid');
      expect([...url.searchParams.entries()]).toEqual(query);
    },
  );

  it('sends application/xml by default, the caller’s Accept when given', async () => {
    const byDefault = new RecordingConnection();
    await utils(byDefault).getNavigationTarget(FRAGMENT);
    expect(byDefault.sent[0]?.headers?.Accept).toBe('application/xml');

    const given = new RecordingConnection();
    await utils(given).getNavigationTarget(FRAGMENT, {
      accept: 'application/vnd.sap.adt.objectreferences+xml',
    });
    expect(given.sent[0]?.headers?.Accept).toBe(
      'application/vnd.sap.adt.objectreferences+xml',
    );
  });

  it('answers the document as it came, through the caller’s analyse', async () => {
    const connection = new RecordingConnection();
    const seen: number[] = [];
    const answer = await utils(connection).getNavigationTarget(FRAGMENT, {
      analyse: (verdict, wire) => {
        seen.push(wire?.status ?? 0);
        return verdict;
      },
    });
    expect(seen).toEqual([200]);
    expect(answer.ok).toBe(true);
    expect(answer.ok && answer.getResult().value).toBe('');
  });
});

describe('the outline and navigation atoms', () => {
  it('AdtUtils is each atom of interfaces-adt, typed by its slot', () => {
    const connection = new RecordingConnection();
    const shipped = utils(connection);
    // Compile-time conformance: a consumer composing its contract from the
    // atoms alone takes the class as it is.
    const outline: IAdtObjectOutlineReadable<string> = shipped;
    const navigation: IAdtNavigationTargetReadable<string> = shipped;
    expect(outline).toBe(navigation);
  });

  it('reads the answer through the navigationTarget slot it was given', async () => {
    const connection = new RecordingConnection();
    const read = new AdtUtils(connection, {
      logger: noopLogger,
      results: { ...utilDocuments, navigationTarget: () => 'read' as const },
    });
    const answer = await read.getNavigationTarget(FRAGMENT);
    expect(answer.ok && answer.getResult().value).toBe('read');
  });

  it('reads the answer through the objectOutline slot it was given', async () => {
    const connection = new RecordingConnection();
    const read = new AdtUtils(connection, {
      logger: noopLogger,
      results: { ...utilDocuments, objectOutline: () => 'outline' as const },
    });
    const answer = await read.getObjectOutline('CLAS/OC', 'ZCL_X');
    expect(answer.ok && answer.getResult().value).toBe('outline');
  });
});
