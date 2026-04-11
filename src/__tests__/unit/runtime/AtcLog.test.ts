import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AtcLog } from '../../../runtime/atc/AtcLog';

describe('AtcLog', () => {
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

  it('getCheckFailureLogs() delegates to /sap/bc/adt/atc/checkfailures/logs', async () => {
    const connection = createConnectionMock();
    const atcLog = new AtcLog(connection, createLogger());

    await atcLog.getCheckFailureLogs();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/atc/checkfailures/logs',
        method: 'GET',
      }),
    );
  });

  it('getCheckFailureLogs() passes options as query params', async () => {
    const connection = createConnectionMock();
    const atcLog = new AtcLog(connection, createLogger());

    await atcLog.getCheckFailureLogs({
      displayId: 'D1',
      objName: 'ZCLS',
      objType: 'CLAS',
    });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/atc/checkfailures/logs',
        method: 'GET',
        params: expect.objectContaining({
          displayId: 'D1',
          objName: 'ZCLS',
          objType: 'CLAS',
        }),
      }),
    );
  });

  it('getExecutionLog() delegates to /sap/bc/adt/atc/results/exec123/log', async () => {
    const connection = createConnectionMock();
    const atcLog = new AtcLog(connection, createLogger());

    await atcLog.getExecutionLog('exec123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/atc/results/exec123/log',
        method: 'GET',
      }),
    );
  });
});
