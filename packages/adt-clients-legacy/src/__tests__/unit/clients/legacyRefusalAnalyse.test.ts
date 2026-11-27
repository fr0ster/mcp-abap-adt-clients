/**
 * C3 of #304 for the legacy refusals: a member 7.40 SP04 does not serve
 * answers the library's own refusal (`UNSUPPORTED_OPERATION`), typed
 * `E | IAdtError` with no cast. No request is sent, and `analyse` is never
 * called — there is no answer for it to read. One member per refusal helper.
 */
import {
  type ADT_NO_FAILURE,
  AdtObjectErrorCodes,
  type IAdtError,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { headersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

function recording() {
  const sent: string[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { url: string; method: string }) => {
      sent.push(`${request.method} ${request.url}`);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
  } as unknown as IAbapConnection;
  return { connection, sent };
}

interface IMine extends IAdtError {
  readonly mine: true;
}

function spy() {
  const calls: unknown[] = [];
  const analyse = (verdict: IAdtError | typeof ADT_NO_FAILURE) => {
    calls.push(verdict);
    const mine: IMine = { origin: 'refusal', message: 'mine', mine: true };
    return mine;
  };
  return { calls, analyse };
}

type Call = (...args: unknown[]) => Promise<unknown>;

/** A member called as a consumer of any system would: its arguments untyped. */
function member(client: AdtClientLegacy, getter: string, name: string): Call {
  const factory = Reflect.get(client, getter) as () => object;
  const handler = factory.call(client);
  const fn = Reflect.get(handler, name) as Call;
  return (...args) => fn.apply(handler, args);
}

const refusals: [
  string,
  (
    client: AdtClientLegacy,
    analyse: ReturnType<typeof spy>['analyse'],
  ) => Promise<unknown>,
][] = [
  [
    'getPackage().create (UNSUPPORTED)',
    (client, analyse) =>
      member(
        client,
        'getPackage',
        'create',
      )(
        { packageName: 'ZP', description: 'd', superPackage: '$TMP' },
        {
          headers: {
            accept: 'application/xml',
            contentType: 'application/xml',
          },
          analyse,
        },
      ),
  ],
  [
    'getRequest().create (unsupported)',
    (client, analyse) =>
      member(
        client,
        'getRequest',
        'create',
      )(
        { description: 'd' },
        { headers: headersOf(client.getRequest(), 'create'), analyse },
      ),
  ],
  [
    'getClass().checkDeletion (noDeletionCheck)',
    (client, analyse) =>
      member(
        client,
        'getClass',
        'checkDeletion',
      )({ className: 'ZCL' }, { analyse }),
  ],
  [
    'getUtils().readObjectSource of a code 7.40 lacks (refuseRead)',
    (client, analyse) =>
      member(client, 'getUtils', 'readObjectSource')(
        'TABL/DS',
        'ZS',
        undefined,
        'active',
        { analyse },
      ),
  ],
];

describe('a legacy refusal answers the library error, with no request and no analyse', () => {
  it.each(refusals)('%s', async (_name, call) => {
    const { connection, sent } = recording();
    const { calls, analyse } = spy();
    const answer = (await call(new AdtClientLegacy(connection), analyse)) as {
      ok: boolean;
      getError: () => IAdtError;
    };
    expect(answer.ok).toBe(false);
    expect(answer.getError().code).toBe(
      AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    );
    expect('mine' in answer.getError()).toBe(false);
    expect(sent).toEqual([]);
    expect(calls).toEqual([]);
  });
});
