import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CrossTrace } from '../../../runtime/traces/CrossTrace';

describe('CrossTrace', () => {
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

  it('list() delegates to /sap/bc/adt/crosstrace/traces', async () => {
    const connection = createConnectionMock();
    const crossTrace = new CrossTrace(connection, createLogger());

    await crossTrace.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces',
        method: 'GET',
      }),
    );
  });

  it('getById() delegates to /sap/bc/adt/crosstrace/traces/TRACE001', async () => {
    const connection = createConnectionMock();
    const crossTrace = new CrossTrace(connection, createLogger());

    await crossTrace.getById('TRACE001');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/TRACE001',
        method: 'GET',
      }),
    );
  });

  it('getRecords() delegates to /sap/bc/adt/crosstrace/traces/TRACE001/records', async () => {
    const connection = createConnectionMock();
    const crossTrace = new CrossTrace(connection, createLogger());

    await crossTrace.getRecords('TRACE001');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/TRACE001/records',
        method: 'GET',
      }),
    );
  });

  it('getRecordContent() delegates to /sap/bc/adt/crosstrace/traces/TRACE001/records/3/content', async () => {
    const connection = createConnectionMock();
    const crossTrace = new CrossTrace(connection, createLogger());

    await crossTrace.getRecordContent('TRACE001', 3);

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/traces/TRACE001/records/3/content',
        method: 'GET',
      }),
    );
  });

  it('getActivations() delegates to /sap/bc/adt/crosstrace/activations', async () => {
    const connection = createConnectionMock();
    const crossTrace = new CrossTrace(connection, createLogger());

    await crossTrace.getActivations();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/crosstrace/activations',
        method: 'GET',
      }),
    );
  });
});
