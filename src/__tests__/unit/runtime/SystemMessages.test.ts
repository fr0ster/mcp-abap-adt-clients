import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { SystemMessages } from '../../../runtime/systemMessages/SystemMessages';

describe('SystemMessages', () => {
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

  it('list() delegates to /sap/bc/adt/runtime/systemmessages', async () => {
    const connection = createConnectionMock();
    const sm = new SystemMessages(connection, createLogger());

    await sm.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/systemmessages',
        method: 'GET',
      }),
    );
  });

  it('list() with maxResults passes $top parameter', async () => {
    const connection = createConnectionMock();
    const sm = new SystemMessages(connection, createLogger());

    await sm.list({ maxResults: 10 });

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toMatch(/%24top=10|\$top=10/);
  });

  it('list() with user passes $query parameter', async () => {
    const connection = createConnectionMock();
    const sm = new SystemMessages(connection, createLogger());

    await sm.list({ user: 'ADMIN' });

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(call.url).toMatch(/%24query|\$query/);
    expect(call.url).toContain('ADMIN');
  });

  it('getById() delegates to /sap/bc/adt/runtime/systemmessages/MSG001', async () => {
    const connection = createConnectionMock();
    const sm = new SystemMessages(connection, createLogger());

    await sm.getById('MSG001');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/systemmessages/MSG001',
        method: 'GET',
      }),
    );
  });
});
