/**
 * AdtClientLegacy refuses a handler over a connection nobody connected, as
 * the root package's `clientConnectGuard.test.ts` pins for AdtClient. The
 * stub connections are that file's.
 */
import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
  type IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

jest.setTimeout(20_000);

/** The five methods of IAbapConnection, and nothing else. */
function baseConnection(): IAbapConnection {
  return {
    connect: async () => {},
    getBaseUrl: async () => 'https://h',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async <T = unknown, D = unknown>() =>
      ({
        data: undefined,
        status: 200,
        statusText: 'OK',
        headers: {},
      }) as unknown as IAdtWireResponse<T, D>,
  };
}

/** A session-aware connection, reporting whatever the test needs. */
function sessionAware(connected: boolean): IAbapConnection {
  return {
    ...baseConnection(),
    isConnected: () => connected,
    disconnect: async () => ({ abandonedWindows: [], releasePending: false }),
    getSessionIdentity: () => (connected ? 'SAP_SESSIONID_T_100=S1' : null),
  } as IAbapConnection;
}

describe('AdtClient connect guard', () => {
  /**
   * The legacy client's own getters, discovered the same way.
   *
   * Each override replaces the base factory, so the base's guard does not run
   * for it: a legacy getter that forgets the check hands out a handler over an
   * unconnected connection — or, for a type the legacy system lacks, a refusal
   * that says nothing about the connection. An RFC connection does declare
   * isConnected(), so the check is not academic there.
   */
  it('guards every factory the legacy client overrides', () => {
    const client = new AdtClientLegacy(sessionAware(false), undefined);
    const factories = Object.getOwnPropertyNames(
      AdtClientLegacy.prototype,
    ).filter((name) => /^get[A-Z]/.test(name));

    // The legacy client overrides the getters of the types it serves
    // differently and of every type it lacks.
    expect(factories.length).toBeGreaterThanOrEqual(25);

    const unguarded: string[] = [];
    for (const name of factories) {
      let code: string | undefined;
      try {
        (client as unknown as Record<string, () => unknown>)[name]();
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      if (code !== ADT_SESSION_ERROR.NOT_CONNECTED) unguarded.push(name);
    }
    expect(unguarded).toEqual([]);
  });

  it('hands out a legacy handler once the connection reports connected', () => {
    const client = new AdtClientLegacy(sessionAware(true), undefined);
    expect(client.getInclude()).toBeDefined();
    expect(client.getDomain()).toBeDefined();
  });
});
