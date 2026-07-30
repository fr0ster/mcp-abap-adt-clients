/**
 * AdtClient refuses a handler over a connection nobody connected.
 *
 * Connecting stays the consumer's job. What this pins is the case the consumer
 * cannot be protected from any other way: a connector injected without
 * connect(). Without the check the handlers walk the whole chain collecting
 * ADT_NOT_CONNECTED into state.errors, which reads as "the operation failed"
 * rather than "you never connected".
 *
 * No SAP, no HTTP:
 *   MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/session
 */
import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
  type IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';

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
      }) as unknown as IAdtResponse<T, D>,
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
  it('refuses a handler when the connection reports not connected', () => {
    const client = new AdtClient(sessionAware(false), undefined);
    expect(() => client.getClass()).toThrow(/connect\(\)/i);
    try {
      client.getClass();
    } catch (error) {
      expect((error as { code?: string }).code).toBe(
        ADT_SESSION_ERROR.NOT_CONNECTED,
      );
    }
  });

  it('hands out a handler once it reports connected', () => {
    const client = new AdtClient(sessionAware(true), undefined);
    expect(client.getClass()).toBeDefined();
  });

  // The check must not become a requirement to implement the atom. An RFC
  // connection owns no HTTP session and has no isConnected() — blocking it on
  // its silence would break a transport for a capability it does not have.
  it('does not block a connection that cannot answer the question', () => {
    const client = new AdtClient(baseConnection(), undefined);
    expect(client.getClass()).toBeDefined();
  });

  // Narrowing promises the WHOLE atom, so a partial implementation must not be
  // trusted with it. Here isConnected() would say false, and the guard still
  // steps aside — because an object with one of the three methods is not a
  // session-aware connection, and guessing from a fragment is how a test double
  // ends up steering production behaviour.
  it('ignores a connection that implements only part of the atom', () => {
    const partial = {
      ...baseConnection(),
      isConnected: () => false,
    } as IAbapConnection;
    const client = new AdtClient(partial, undefined);
    expect(client.getClass()).toBeDefined();
  });

  it('guards every factory, not just the first one', () => {
    const client = new AdtClient(sessionAware(false), undefined);
    const factories = [
      () => client.getClass(),
      () => client.getProgram(),
      () => client.getInterface(),
      () => client.getPackage(),
      () => client.getTable(),
      () => client.getDomain(),
      () => client.getDdl(),
    ];
    for (const make of factories) {
      // toThrow(string) matches the MESSAGE, so the code has to be read off the
      // error itself — the whole point of a code is that it survives rewording.
      let code: string | undefined;
      try {
        make();
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      expect(code).toBe(ADT_SESSION_ERROR.NOT_CONNECTED);
    }
  });
});
