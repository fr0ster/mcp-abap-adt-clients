import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
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

    await snapshots.list('DEVELOPER', 'ORIG_USER');

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

  it('getById() throws when snapshotId is empty', async () => {
    const connection = createConnectionMock();
    const snapshots = new MemorySnapshots(connection, createLogger());

    await expect(snapshots.getById('')).rejects.toThrow(
      'Snapshot ID is required',
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

    await snapshots.getDeltaOverview('uri1', 'uri2');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          '/sap/bc/adt/runtime/memory/snapdelta/overview',
        ),
        method: 'GET',
      }),
    );
  });
});
