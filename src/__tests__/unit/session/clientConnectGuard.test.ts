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
 *   npx jest src/__tests__/unit/session
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

  // A connection carrying isConnected() and nothing else IS asked, because the
  // guard calls only isConnected(). Demanding the whole atom would make it step
  // aside for a connection that could have answered — refusing evidence it was
  // offered. That is the opposite rule from a type PREDICATE, which narrows to
  // the whole interface and so must verify the whole interface.
  it('asks a connection that implements only the method it calls', () => {
    const partial = {
      ...baseConnection(),
      isConnected: () => false,
    } as IAbapConnection;
    const client = new AdtClient(partial, undefined);
    expect(() => client.getClass()).toThrow(/connect\(\)/i);
  });

  /**
   * EVERY factory, discovered rather than listed.
   *
   * An earlier version named seven by hand, which pinned seven and said nothing
   * about the rest — a guard missing from any other factory would have passed.
   * Enumerating the prototype means a factory added later is covered on the day
   * it is added, and one that loses its guard fails here.
   */
  it('guards every factory', () => {
    const client = new AdtClient(sessionAware(false), undefined);
    const factories = Object.getOwnPropertyNames(AdtClient.prototype).filter(
      (name) => /^get[A-Z]/.test(name),
    );

    // A floor, so that a refactor renaming the factories into oblivion cannot
    // turn this into a test that asserts nothing.
    expect(factories.length).toBeGreaterThanOrEqual(36);

    const unguarded: string[] = [];
    for (const name of factories) {
      let code: string | undefined;
      try {
        (client as unknown as Record<string, () => unknown>)[name]();
      } catch (error) {
        // toThrow(string) matches the MESSAGE, so the code is read off the error
        // itself — the point of a code is that it survives rewording.
        code = (error as { code?: string }).code;
      }
      if (code !== ADT_SESSION_ERROR.NOT_CONNECTED) unguarded.push(name);
    }
    expect(unguarded).toEqual([]);
  });
});
