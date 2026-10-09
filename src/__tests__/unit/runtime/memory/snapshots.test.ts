import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  getSnapshot,
  getSnapshotChildren,
  getSnapshotDeltaChildren,
  getSnapshotDeltaOverview,
  getSnapshotDeltaRankingList,
  getSnapshotDeltaReferences,
  getSnapshotOverview,
  getSnapshotRankingList,
  getSnapshotReferences,
  listSnapshots,
} from '../../../../runtime/memory/snapshots';

describe('runtime/memory/snapshots', () => {
  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;
  }

  it('listSnapshots supports optional user filters', async () => {
    const connection = createConnectionMock();

    await listSnapshots(connection);
    await listSnapshots(connection, 'CB9980000423', 'BATCH_USER');

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots',
        method: 'GET',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots?user=CB9980000423&originalUser=BATCH_USER',
        method: 'GET',
      }),
    );
  });

  it('getSnapshot builds the snapshot URL', async () => {
    const connection = createConnectionMock();

    await getSnapshot(connection, 'SNAP1');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/SNAP1',
        method: 'GET',
      }),
    );
  });

  it('getSnapshotRankingList builds ranking query with array and flags', async () => {
    const connection = createConnectionMock();

    await getSnapshotRankingList(connection, 'SNAP1', {
      maxNumberOfObjects: 5,
      excludeAbapType: ['CLAS', 'INTF'],
      sortAscending: true,
      sortByColumnName: 'size',
      groupByParentType: false,
    });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/SNAP1/rankinglist?maxNumberOfObjects=5&excludeAbapType=CLAS&excludeAbapType=INTF&sortAscending=true&sortByColumnName=size&groupByParentType=false',
        method: 'GET',
      }),
    );
  });

  it('getSnapshotDeltaRankingList builds URL', async () => {
    const connection = createConnectionMock();

    await getSnapshotDeltaRankingList(connection, '/snap/1', '/snap/2', {
      maxNumberOfObjects: 10,
      sortAscending: false,
    });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapdelta/rankinglist?uri1=%2Fsnap%2F1&uri2=%2Fsnap%2F2&maxNumberOfObjects=10&sortAscending=false',
      }),
    );
  });

  it('getSnapshotChildren and getSnapshotDeltaChildren build URLs', async () => {
    const connection = createConnectionMock();

    await getSnapshotChildren(connection, 'SNAP1', 'NODE1', {
      maxNumberOfObjects: 20,
      sortAscending: true,
      sortByColumnName: 'name',
    });

    await getSnapshotDeltaChildren(connection, '/s1', '/s2', 'NODE1', {
      maxNumberOfObjects: 7,
      sortAscending: false,
      sortByColumnName: 'size',
    });

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/SNAP1/children?parentKey=NODE1&maxNumberOfObjects=20&sortAscending=true&sortByColumnName=name',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapdelta/children?uri1=%2Fs1&uri2=%2Fs2&parentKey=NODE1&maxNumberOfObjects=7&sortAscending=false&sortByColumnName=size',
      }),
    );
  });

  it('getSnapshotReferences and delta references build URLs', async () => {
    const connection = createConnectionMock();

    await getSnapshotReferences(connection, 'SNAP1', 'OBJ1', {
      maxNumberOfReferences: 42,
    });

    await getSnapshotDeltaReferences(connection, '/s1', '/s2', 'OBJ1', {
      maxNumberOfReferences: 11,
    });

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/SNAP1/references?objectKey=OBJ1&maxNumberOfReferences=42',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapdelta/references?uri1=%2Fs1&uri2=%2Fs2&objectKey=OBJ1&maxNumberOfReferences=11',
      }),
    );
  });

  it('getSnapshotOverview and delta overview build URLs', async () => {
    const connection = createConnectionMock();

    await getSnapshotOverview(connection, 'SNAP1');

    await getSnapshotDeltaOverview(connection, '/s1', '/s2');

    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapshots/SNAP1/overview',
      }),
    );
    expect(connection.makeAdtRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/memory/snapdelta/overview?uri1=%2Fs1&uri2=%2Fs2',
      }),
    );
  });
});
