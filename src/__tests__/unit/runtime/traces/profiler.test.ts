import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  buildTraceParametersXml,
  createTraceParameters,
  extractProfilerIdFromResponse,
  extractTraceIdFromTraceRequestsResponse,
  getTraceDbAccesses,
  getTraceHitList,
  getTraceRequestsByUri,
  getTraceStatements,
  listObjectTypes,
  listProcessTypes,
  listTraceFiles,
  listTraceRequests,
  normalizeProfilerTraceId,
} from '../../../../runtime/traces/profiler';

describe('runtime/traces/profiler', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  it('normalizeProfilerTraceId supports plain IDs and ADT URIs', () => {
    expect(normalizeProfilerTraceId('TRACE123')).toBe('TRACE123');
    expect(
      normalizeProfilerTraceId(
        '/sap/bc/adt/runtime/traces/abaptraces/ABCD1234EFGH5678/hitlist',
      ),
    ).toBe('ABCD1234EFGH5678');
    expect(() => normalizeProfilerTraceId('')).toThrow('Trace ID is required');
  });

  it('buildTraceParametersXml merges defaults and escapes description', () => {
    const xml = buildTraceParametersXml({
      description: `a "b" & <c>`,
      sqlTrace: false,
      maxTimeForTracing: 12.9,
    });
    expect(xml).toContain('<trc:sqlTrace value="false"/>');
    expect(xml).toContain('<trc:maxTimeForTracing value="12"/>');
    expect(xml).toContain(
      '<trc:description value="a &quot;b&quot; &amp; &lt;c&gt;"/>',
    );
  });

  it('createTraceParameters posts XML payload', async () => {
    const connection = createConnectionMock();

    await createTraceParameters(connection, { aggregate: true });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/parameters',
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/xml',
          'Content-Type': 'application/xml',
        }),
      }),
    );
  });

  it('extractProfilerIdFromResponse reads location from response headers', () => {
    expect(
      extractProfilerIdFromResponse({
        headers: {
          location:
            'https://host/sap/bc/adt/runtime/traces/abaptraces/ABCD1234EFGH5678',
        },
      } as any),
    ).toBe('/sap/bc/adt/runtime/traces/abaptraces/ABCD1234EFGH5678');

    expect(
      extractProfilerIdFromResponse({
        headers: { location: '/sap/bc/adt/runtime/traces/abaptraces/ID123' },
      } as any),
    ).toBe('/sap/bc/adt/runtime/traces/abaptraces/ID123');
  });

  it('extractTraceIdFromTraceRequestsResponse reads trace id from header or body', () => {
    expect(
      extractTraceIdFromTraceRequestsResponse({
        headers: {
          location:
            '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890/statements',
        },
      } as any),
    ).toBe('ABCDEF1234567890');

    expect(
      extractTraceIdFromTraceRequestsResponse({
        data: '<a href="/sap/bc/adt/runtime/traces/abaptraces/A1B2C3D4E5F6G7H8"/>',
      } as any),
    ).toBe('A1B2C3D4E5F6G7H8');
  });

  it('getTraceHitList/getTraceStatements/getTraceDbAccesses build query params', async () => {
    const connection = createConnectionMock();

    await getTraceHitList(
      connection,
      '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890',
      { withSystemEvents: true },
    );
    await getTraceStatements(connection, 'ABCDEF1234567890', {
      id: 3.9,
      withDetails: false,
      autoDrillDownThreshold: 10.7,
      withSystemEvents: true,
    });
    await getTraceDbAccesses(connection, 'ABCDEF1234567890', {
      withSystemEvents: false,
    });

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890/hitlist?withSystemEvents=true',
        method: 'GET',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890/statements?id=3&withDetails=false&autoDrillDownThreshold=10&withSystemEvents=true',
        method: 'GET',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF1234567890/dbAccesses?withSystemEvents=false',
        method: 'GET',
      }),
    );
  });

  it('getTraceRequestsByUri validates uri and encodes query param', async () => {
    const connection = createConnectionMock();

    await expect(getTraceRequestsByUri(connection, '')).rejects.toThrow(
      'URI is required',
    );
    await getTraceRequestsByUri(connection, '/sap/bc/adt/oo/classes/zcl_test');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/requests?uri=%2Fsap%2Fbc%2Fadt%2Foo%2Fclasses%2Fzcl_test',
        method: 'GET',
      }),
    );
  });

  it('listTrace* endpoints use expected URLs', async () => {
    const connection = createConnectionMock();

    await listTraceFiles(connection);
    await listTraceRequests(connection);
    await listObjectTypes(connection);
    await listProcessTypes(connection);

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/requests',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/objecttypes',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/processtypes',
      }),
    );
  });
});
