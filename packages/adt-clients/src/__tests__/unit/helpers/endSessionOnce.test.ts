/**
 * The harness ends a connection's session once, and never one already ended.
 *
 * Since `@mcp-abap-adt/connection` 16 one instance is one SAP session: a
 * second `disconnect()` rejects `NOT_CONNECTED`, and an instance whose session
 * ended — disconnected, or lost — has nothing left to log off. A test that
 * recycled its session and then reached `afterAll` would otherwise disconnect
 * the spent instance a second time.
 */

import { closeOwnTestConnection } from '../../helpers/sessionConfig';

function fakeConnection(connected: boolean) {
  return {
    isConnected: () => connected,
    disconnect: jest.fn(async () => undefined),
  };
}

describe('closeOwnTestConnection', () => {
  it('disconnects a connection that is still connected, once', async () => {
    const connection = fakeConnection(true);
    await closeOwnTestConnection(connection);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('leaves a connection whose session already ended alone', async () => {
    const connection = fakeConnection(false);
    await closeOwnTestConnection(connection);
    expect(connection.disconnect).not.toHaveBeenCalled();
  });
});
