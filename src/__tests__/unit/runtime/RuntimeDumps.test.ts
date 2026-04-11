import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { RuntimeDumps } from '../../../runtime/dumps/RuntimeDumps';

describe('RuntimeDumps', () => {
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

  it('list() URL contains $top=10 when top option is provided', async () => {
    const connection = createConnectionMock();
    const dumps = new RuntimeDumps(connection, createLogger());

    await dumps.list({ top: 10 });

    const call = (connection.makeAdtRequest as jest.Mock).mock.calls[0][0];
    // URLSearchParams encodes $ as %24; verify the parameter is present
    expect(call.url).toMatch(/%24top=10|\$top=10/);
  });

  it('getById() delegates to /sap/bc/adt/runtime/dump/DUMP123', async () => {
    const connection = createConnectionMock();
    const dumps = new RuntimeDumps(connection, createLogger());

    await dumps.getById('DUMP123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dump/DUMP123',
        method: 'GET',
      }),
    );
  });

  it('getById() with view=summary delegates to /sap/bc/adt/runtime/dump/DUMP123/summary', async () => {
    const connection = createConnectionMock();
    const dumps = new RuntimeDumps(connection, createLogger());

    await dumps.getById('DUMP123', { view: 'summary' });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dump/DUMP123/summary',
        method: 'GET',
      }),
    );
  });

  it('buildIdPrefix() composes the correct prefix string', () => {
    const dumps = new RuntimeDumps(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const prefix = dumps.buildIdPrefix(
      '20260331215347',
      'epbyminsd0654',
      'E19',
      '00',
    );

    expect(prefix).toBe('20260331215347epbyminsd0654_E19_00');
  });

  it('buildUserQuery() returns undefined when user is empty', () => {
    const dumps = new RuntimeDumps(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    expect(dumps.buildUserQuery()).toBeUndefined();
    expect(dumps.buildUserQuery('')).toBeUndefined();
    expect(dumps.buildUserQuery('   ')).toBeUndefined();
  });

  it('buildUserQuery() returns ADT query expression for a given user', () => {
    const dumps = new RuntimeDumps(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const query = dumps.buildUserQuery('CB9980000423');

    expect(query).toBe('and( equals( user, CB9980000423 ) )');
  });
});
