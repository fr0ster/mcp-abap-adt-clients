import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { Profiler } from '../../../runtime/traces/Profiler';

describe('Profiler', () => {
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

  it('listTraceFiles() delegates to /sap/bc/adt/runtime/traces/abaptraces', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.listTraceFiles();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces',
        method: 'GET',
      }),
    );
  });

  it('getParameters() delegates to /sap/bc/adt/runtime/traces/abaptraces/parameters', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.getParameters();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/parameters',
        method: 'GET',
      }),
    );
  });

  it('listRequests() delegates to /sap/bc/adt/runtime/traces/abaptraces/requests', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.listRequests();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/requests',
        method: 'GET',
      }),
    );
  });

  it('buildParametersXml() returns XML string with default parameters', () => {
    const profiler = new Profiler(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const xml = profiler.buildParametersXml();

    expect(typeof xml).toBe('string');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('trc:parameters');
  });

  it('getDefaultParameters() returns a copy of default profiler parameters', () => {
    const profiler = new Profiler(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const defaults = profiler.getDefaultParameters();

    expect(defaults).toMatchObject({
      allProceduralUnits: true,
      sqlTrace: true,
      allDbEvents: true,
      amdpTrace: true,
    });
    // Must be a copy, not the same reference
    expect(defaults).not.toBe(profiler.getDefaultParameters());
  });
});
