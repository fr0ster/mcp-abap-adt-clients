import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { GatewayErrorLog } from '../../../runtime/gatewayErrorLog/GatewayErrorLog';

describe('GatewayErrorLog', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  function createLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
  }

  it('list() delegates to /sap/bc/adt/gw/errorlog', async () => {
    const connection = createConnectionMock();
    const gwLog = new GatewayErrorLog(connection, createLogger());

    await gwLog.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/gw/errorlog',
        method: 'GET',
      }),
    );
  });

  it('list() with maxResults passes $top parameter', async () => {
    const connection = createConnectionMock();
    const gwLog = new GatewayErrorLog(connection, createLogger());

    await gwLog.list({ maxResults: 20 });

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toMatch(/%24top=20|\$top=20/);
  });

  it('getById() encodes error type in URL', async () => {
    const connection = createConnectionMock();
    const gwLog = new GatewayErrorLog(connection, createLogger());

    await gwLog.getById('Frontend Error', '66BF65D1A9DD1FD18D97D52042DF3925');

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(
      '/sap/bc/adt/gw/errorlog/Frontend%20Error/66BF65D1A9DD1FD18D97D52042DF3925',
    );
    expect(call.method).toBe('GET');
  });

  it('getById() works with simple error type', async () => {
    const connection = createConnectionMock();
    const gwLog = new GatewayErrorLog(connection, createLogger());

    await gwLog.getById('BackendError', 'ABC123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/gw/errorlog/BackendError/ABC123',
        method: 'GET',
      }),
    );
  });
});
