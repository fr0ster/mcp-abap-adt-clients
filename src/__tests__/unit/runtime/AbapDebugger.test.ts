import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AbapDebugger } from '../../../runtime/debugger/AbapDebugger';

describe('AbapDebugger', () => {
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

  it('launch() delegates to /sap/bc/adt/debugger/listeners with launch relation', async () => {
    const connection = createConnectionMock();
    const debugger_ = new AbapDebugger(connection, createLogger());

    await debugger_.launch();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/debugger/listeners',
        method: 'GET',
        headers: expect.objectContaining({
          'X-sap-adt-relation':
            'http://www.sap.com/adt/debugger/relations/launch',
        }),
      }),
    );
  });

  it('launch() passes options as params', async () => {
    const connection = createConnectionMock();
    const debugger_ = new AbapDebugger(connection, createLogger());

    await debugger_.launch({ debuggingMode: 'user', terminalId: 'term1' });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          debuggingMode: 'user',
          terminalId: 'term1',
        }),
      }),
    );
  });

  it('stop() delegates to /sap/bc/adt/debugger/listeners with stop relation', async () => {
    const connection = createConnectionMock();
    const debugger_ = new AbapDebugger(connection, createLogger());

    await debugger_.stop();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/debugger/listeners',
        method: 'GET',
        headers: expect.objectContaining({
          'X-sap-adt-relation':
            'http://www.sap.com/adt/debugger/relations/stop',
        }),
      }),
    );
  });

  it('getCallStack() delegates to /sap/bc/adt/debugger/stack', async () => {
    const connection = createConnectionMock();
    const debugger_ = new AbapDebugger(connection, createLogger());

    await debugger_.getCallStack();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/debugger/stack',
        method: 'GET',
      }),
    );
  });

  it('buildBatchPayload() returns boundary and body for given requests', () => {
    const debugger_ = new AbapDebugger(
      {} as unknown as IAbapConnection,
      createLogger(),
    );

    const result = debugger_.buildBatchPayload([
      'GET /sap/bc/adt/debugger HTTP/1.1\r\n',
    ]);

    expect(result).toHaveProperty('boundary');
    expect(result).toHaveProperty('body');
    expect(typeof result.boundary).toBe('string');
    expect(result.body).toContain('Content-Type: application/http');
  });

  it('buildBatchPayload() throws when no requests provided', () => {
    const debugger_ = new AbapDebugger(
      {} as unknown as IAbapConnection,
      createLogger(),
    );

    expect(() => debugger_.buildBatchPayload([])).toThrow(
      'At least one batch request is required',
    );
  });

  it('buildStepWithStackBatchPayload() returns payload containing stepInto and getStack', () => {
    const debugger_ = new AbapDebugger(
      {} as unknown as IAbapConnection,
      createLogger(),
    );

    const result = debugger_.buildStepWithStackBatchPayload('stepInto');

    expect(result.body).toContain('stepInto');
    expect(result.body).toContain('getStack');
  });

  it('executeAction() delegates to /sap/bc/adt/debugger/actions', async () => {
    const connection = createConnectionMock();
    const debugger_ = new AbapDebugger(connection, createLogger());

    await debugger_.executeAction('jumpToLine', 'line42');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/debugger/actions',
        method: 'GET',
        params: expect.objectContaining({
          action: 'jumpToLine',
          value: 'line42',
        }),
      }),
    );
  });
});
