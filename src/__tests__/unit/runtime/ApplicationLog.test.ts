import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ApplicationLog } from '../../../runtime/applicationLog/ApplicationLog';

describe('ApplicationLog', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  function createLogger() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;
  }

  it('getObject() delegates to /sap/bc/adt/applicationlog/objects/Z_MY_LOG', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, createLogger());

    await appLog.getObject('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG',
        method: 'GET',
      }),
    );
  });

  it('getSource() delegates to /sap/bc/adt/applicationlog/objects/Z_MY_LOG/source/main', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, createLogger());

    await appLog.getSource('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/Z_MY_LOG/source/main',
        method: 'GET',
      }),
    );
  });

  it('validateName() delegates to /sap/bc/adt/applicationlog/objects/validation', async () => {
    const connection = createConnectionMock();
    const appLog = new ApplicationLog(connection, createLogger());

    await appLog.validateName('Z_MY_LOG');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/applicationlog/objects/validation',
        method: 'GET',
      }),
    );
  });
});
