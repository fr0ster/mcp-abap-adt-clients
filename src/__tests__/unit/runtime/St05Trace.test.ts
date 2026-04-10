import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { St05Trace } from '../../../runtime/traces/St05Trace';

describe('St05Trace', () => {
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

  it('getState() delegates to /sap/bc/adt/st05/trace/state', async () => {
    const connection = createConnectionMock();
    const trace = new St05Trace(connection, createLogger());

    await trace.getState();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/st05/trace/state',
        method: 'GET',
      }),
    );
  });

  it('getDirectory() delegates to /sap/bc/adt/st05/trace/directory', async () => {
    const connection = createConnectionMock();
    const trace = new St05Trace(connection, createLogger());

    await trace.getDirectory();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/st05/trace/directory',
        method: 'GET',
      }),
    );
  });
});
