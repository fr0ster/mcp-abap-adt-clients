import {
  ADT_SESSION_ERROR,
  type IAbapConnection,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

/**
 * K8 of #304: the not-connected error is built with `Object.assign` instead
 * of a cast and an assignment. It stays an `Error` with its message and an
 * own, enumerable, writable `code` — the shape it had.
 */
describe('the not-connected error', () => {
  it('is an Error with an own enumerable code', () => {
    const connection = {
      makeAdtRequest: async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      }),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => null,
      setSessionType: () => undefined,
      connect: async () => undefined,
      isConnected: () => false,
    } satisfies IAbapConnection & { isConnected(): boolean };
    const client = new AdtClient(connection);
    let thrown: unknown;
    try {
      client.getClass();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(Object.getPrototypeOf(thrown)).toBe(Error.prototype);
    expect(Object.keys(thrown as object)).toEqual(['code']);
    expect(Object.getOwnPropertyDescriptor(thrown, 'code')).toEqual({
      value: ADT_SESSION_ERROR.NOT_CONNECTED,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    expect((thrown as Error).message).toBe(
      'AdtClient: the connection is not connected. Call connect() on it before ' +
        'requesting a handler — this library does not connect on your behalf.',
    );
  });
});
