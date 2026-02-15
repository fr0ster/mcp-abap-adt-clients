import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  buildRuntimeDumpsUserQuery,
  getRuntimeDumpById,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
} from '../../../../runtime/dumps/read';

describe('runtime/dumps/read', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  it('buildRuntimeDumpsUserQuery returns undefined when user is not provided', () => {
    expect(buildRuntimeDumpsUserQuery(undefined)).toBeUndefined();
    expect(buildRuntimeDumpsUserQuery('   ')).toBeUndefined();
  });

  it('buildRuntimeDumpsUserQuery builds user filter query', () => {
    expect(buildRuntimeDumpsUserQuery('CB9980000423')).toBe(
      'and( equals( user, CB9980000423 ) )',
    );
  });

  it('listRuntimeDumps requests all dumps when no options are provided', async () => {
    const connection = createConnectionMock();

    await listRuntimeDumps(connection);

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps',
        method: 'GET',
      }),
    );
  });

  it('listRuntimeDumpsByUser falls back to all dumps when user is missing', async () => {
    const connection = createConnectionMock();

    await listRuntimeDumpsByUser(connection, undefined, { top: 50 });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps?%24top=50',
        method: 'GET',
      }),
    );
  });

  it('listRuntimeDumpsByUser uses query filter when user is provided', async () => {
    const connection = createConnectionMock();

    await listRuntimeDumpsByUser(connection, 'CB9980000423', {
      inlinecount: 'allpages',
      top: 50,
    });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps?%24query=and%28+equals%28+user%2C+CB9980000423+%29+%29&%24inlinecount=allpages&%24top=50',
        method: 'GET',
      }),
    );
  });

  it('getRuntimeDumpById validates ID and requests dump payload', async () => {
    const connection = createConnectionMock();

    await expect(getRuntimeDumpById(connection, '   ')).rejects.toThrow(
      'Runtime dump ID is required',
    );
    await expect(
      getRuntimeDumpById(
        connection,
        '/sap/bc/adt/runtime/dumps/ABCDEF1234567890',
      ),
    ).rejects.toThrow('Runtime dump ID must not contain "/"');

    await getRuntimeDumpById(connection, 'ABCDEF1234567890');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps/ABCDEF1234567890',
        method: 'GET',
      }),
    );
  });
});
