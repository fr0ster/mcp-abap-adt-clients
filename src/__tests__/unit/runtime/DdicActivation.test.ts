import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { DdicActivation } from '../../../runtime/ddic/DdicActivation';

describe('DdicActivation', () => {
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

  it('getGraph() delegates to /sap/bc/adt/ddic/logs/activationgraph', async () => {
    const connection = createConnectionMock();
    const activation = new DdicActivation(connection, createLogger());

    await activation.getGraph();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/ddic/logs/activationgraph',
        method: 'GET',
      }),
    );
  });

  it('getGraph() passes options as query params', async () => {
    const connection = createConnectionMock();
    const activation = new DdicActivation(connection, createLogger());

    await activation.getGraph({
      objectName: 'ZTABLE',
      objectType: 'TABL',
      logName: 'LOG1',
    });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/ddic/logs/activationgraph',
        method: 'GET',
        params: expect.objectContaining({
          objectName: 'ZTABLE',
          objectType: 'TABL',
          logName: 'LOG1',
        }),
      }),
    );
  });
});
