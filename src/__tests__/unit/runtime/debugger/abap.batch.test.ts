import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  buildDebuggerBatchPayload,
  buildDebuggerStepWithStackBatchPayload,
  executeDebuggerStepBatch,
  executeDebuggerAction,
  stepContinueDebuggerBatch,
  stepIntoDebuggerBatch,
  stepOutDebuggerBatch,
} from '../../../../runtime/debugger/abap';

describe('runtime/debugger/abap batch stepping', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 202, data: '' }),
    } as unknown as IAbapConnection;
  }

  it('buildDebuggerBatchPayload validates payload parts', () => {
    expect(() => buildDebuggerBatchPayload([])).toThrow(
      'At least one batch request is required',
    );
    expect(() => buildDebuggerBatchPayload(['   '])).toThrow(
      'Batch request part must not be empty',
    );
  });

  it('buildDebuggerStepWithStackBatchPayload builds step + stack multipart body', () => {
    const payload = buildDebuggerStepWithStackBatchPayload('stepInto');

    expect(payload.boundary).toContain('batch_');
    expect(payload.body).toContain(
      'POST /sap/bc/adt/debugger?method=stepInto HTTP/1.1',
    );
    expect(payload.body).toContain(
      'POST /sap/bc/adt/debugger?emode=_&semanticURIs=true&method=getStack HTTP/1.1',
    );
    expect(payload.body).toContain(`--${payload.boundary}`);
    expect(payload.body).toContain(`--${payload.boundary}--`);
  });

  it.each([
    ['stepInto', stepIntoDebuggerBatch, 'method=stepInto'],
    ['stepOut', stepOutDebuggerBatch, 'method=stepOut'],
    ['stepContinue', stepContinueDebuggerBatch, 'method=stepContinue'],
  ])('%s executes multipart batch request', async (_name, fn, expectedMethodQuery) => {
    const connection = createConnectionMock();

    await fn(connection);

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/debugger/batch',
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'multipart/mixed',
        }),
      }),
    );

    const request = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(request.headers['Content-Type']).toContain(
      'multipart/mixed; boundary=',
    );
    expect(request.data).toContain(
      `POST /sap/bc/adt/debugger?${expectedMethodQuery} HTTP/1.1`,
    );
    expect(request.data).toContain('method=getStack');
  });

  it('executeDebuggerStepBatch supports explicit step method', async () => {
    const connection = createConnectionMock();

    await executeDebuggerStepBatch(connection, 'stepOut');

    const request = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    expect(request.data).toContain(
      'POST /sap/bc/adt/debugger?method=stepOut HTTP/1.1',
    );
    expect(request.data).toContain('method=getStack');
  });

  it('blocks step actions via executeDebuggerAction', async () => {
    const connection = createConnectionMock();

    await expect(
      executeDebuggerAction(connection, 'stepInto'),
    ).rejects.toThrow(
      'Debugger action "stepInto" must be executed via debugger batch',
    );
  });
});
