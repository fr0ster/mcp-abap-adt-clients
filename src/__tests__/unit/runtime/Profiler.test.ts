import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { Profiler } from '../../../runtime/traces/ProfilerDomain';

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

  it('list() delegates to /sap/bc/adt/runtime/traces/abaptraces', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces',
        method: 'GET',
      }),
    );
  });

  it('listTraceFiles() is a deprecated alias for list()', async () => {
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

  it('read() sends the view the caller asked for, not a fixed one', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.read('T1', 'statements', { withDetails: true });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          '/sap/bc/adt/runtime/traces/abaptraces/T1/statements',
        ),
        method: 'GET',
      }),
    );
  });

  it('read() refuses a view this family does not have', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    // The compiler rejects this; JavaScript callers reach it, so it throws
    // rather than silently requesting a URL that cannot answer.
    await expect(
      // @ts-expect-error 'callGraph' is not a view of this family
      profiler.read('T1', 'callGraph'),
    ).rejects.toThrow(/Unknown trace view/);
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
