import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { MemorySnapshots } from '../../../runtime/memory/MemorySnapshots';

describe('MemorySnapshots', () => {
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

  it('list() delegates to /sap/bc/adt/runtime/memory/snapshots without params', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots',
        method: 'GET',
      }),
    );
  });

  it('list() includes user and originalUser as query params when provided', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.list({ user: 'DEVELOPER', originalUser: 'ORIG_USER' });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('user=DEVELOPER'),
        method: 'GET',
      }),
    );
  });

  it('getById() delegates to /sap/bc/adt/runtime/memory/snapshots/snap123', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.getById('snap123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/snap123',
        method: 'GET',
      }),
    );
  });

  it('getOverview() delegates to /sap/bc/adt/runtime/memory/snapshots/{id}/overview', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.getOverview('snap123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/snap123/overview',
        method: 'GET',
      }),
    );
  });

  it('getRankingList() delegates to /sap/bc/adt/runtime/memory/snapshots/{id}/rankinglist', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.getRankingList('snap123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/snap123/rankinglist',
        method: 'GET',
      }),
    );
  });

  it('getDeltaOverview() delegates to /sap/bc/adt/runtime/memory/snapdelta/overview', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await snapshots.getDeltaOverview('SNAP1', 'SNAP2');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          '/sap/bc/adt/runtime/memory/snapdelta/overview',
        ),
        method: 'GET',
      }),
    );
  });

  it('a snapshot that does not exist comes back as a failure carrying the answer', async () => {
    const connection = {
      makeAdtRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error('Request failed with status code 404'), {
          response: {
            status: 404,
            headers: {},
            data: '<exc:exception><type id="ExceptionMemoryAnalysisNotFound"/></exc:exception>',
          },
        }),
      ),
    } as unknown as IAbapConnection;
    const answer = await new MemorySnapshots(connection).getById('MISSING');
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(String(answer.getError().response?.data)).toContain(
        'ExceptionMemoryAnalysisNotFound',
      );
    }
  });

  it('answers the document as it arrived by default', async () => {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        status: 200,
        headers: {},
        data: '<mi:overview/>',
      }),
    } as unknown as IAbapConnection;
    const answer = await new MemorySnapshots(connection).getOverview('S');
    expect(answer.ok && answer.getResult().value).toBe('<mi:overview/>');
  });
});
