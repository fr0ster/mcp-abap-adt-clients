/**
 * Runtime Memory Analysis - Snapshots
 * 
 * Provides functions for analyzing runtime memory snapshots, including:
 * - Listing and retrieving snapshots
 * - Ranking lists of objects in snapshots
 * - Getting children and references
 * - Delta comparisons between snapshots
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Options for snapshot ranking list queries
 */
export interface ISnapshotRankingListOptions {
  maxNumberOfObjects?: number;
  excludeAbapType?: string[];
  sortAscending?: boolean;
  sortByColumnName?: string;
  groupByParentType?: boolean;
}

/**
 * Options for snapshot children queries
 */
export interface ISnapshotChildrenOptions {
  maxNumberOfObjects?: number;
  sortAscending?: boolean;
  sortByColumnName?: string;
}

/**
 * Options for snapshot references queries
 */
export interface ISnapshotReferencesOptions {
  maxNumberOfReferences?: number;
}

/**
 * List memory snapshots
 * 
 * @param connection - ABAP connection
 * @param user - Filter by user (optional)
 * @param originalUser - Filter by original user (optional)
 * @returns Axios response with list of snapshots
 */
export async function listSnapshots(
  connection: IAbapConnection,
  user?: string,
  originalUser?: string
): Promise<AxiosResponse> {
  const params = new URLSearchParams();
  if (user) params.append('user', user);
  if (originalUser) params.append('originalUser', originalUser);

  const url = `/sap/bc/adt/runtime/memory/snapshots${params.toString() ? `?${params.toString()}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get specific snapshot details
 * 
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @returns Axios response with snapshot details
 */
export async function getSnapshot(
  connection: IAbapConnection,
  snapshotId: string
): Promise<AxiosResponse> {
  if (!snapshotId) {
    throw new Error('Snapshot ID is required');
  }

  const url = `/sap/bc/adt/runtime/memory/snapshots/${snapshotId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get ranking list of objects in snapshot
 * 
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param options - Ranking list options
 * @returns Axios response with ranking list
 */
export async function getSnapshotRankingList(
  connection: IAbapConnection,
  snapshotId: string,
  options?: ISnapshotRankingListOptions
): Promise<AxiosResponse> {
  if (!snapshotId) {
    throw new Error('Snapshot ID is required');
  }

  const params = new URLSearchParams();
  if (options?.maxNumberOfObjects) params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  if (options?.excludeAbapType) {
    options.excludeAbapType.forEach(type => params.append('excludeAbapType', type));
  }
  if (options?.sortAscending !== undefined) params.append('sortAscending', String(options.sortAscending));
  if (options?.sortByColumnName) params.append('sortByColumnName', options.sortByColumnName);
  if (options?.groupByParentType !== undefined) params.append('groupByParentType', String(options.groupByParentType));

  const url = `/sap/bc/adt/runtime/memory/snapshots/${snapshotId}/rankinglist${params.toString() ? `?${params.toString()}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get delta ranking list between two snapshots
 * 
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param options - Ranking list options
 * @returns Axios response with delta ranking list
 */
export async function getSnapshotDeltaRankingList(
  connection: IAbapConnection,
  uri1: string,
  uri2: string,
  options?: ISnapshotRankingListOptions
): Promise<AxiosResponse> {
  if (!uri1 || !uri2) {
    throw new Error('Both snapshot URIs are required');
  }

  const params = new URLSearchParams();
  params.append('uri1', uri1);
  params.append('uri2', uri2);
  if (options?.maxNumberOfObjects) params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  if (options?.excludeAbapType) {
    options.excludeAbapType.forEach(type => params.append('excludeAbapType', type));
  }
  if (options?.sortAscending !== undefined) params.append('sortAscending', String(options.sortAscending));
  if (options?.sortByColumnName) params.append('sortByColumnName', options.sortByColumnName);
  if (options?.groupByParentType !== undefined) params.append('groupByParentType', String(options.groupByParentType));

  const url = `/sap/bc/adt/runtime/memory/snapdelta/rankinglist?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get children of a parent object in snapshot
 * 
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param parentKey - Parent object key
 * @param options - Children query options
 * @returns Axios response with children list
 */
export async function getSnapshotChildren(
  connection: IAbapConnection,
  snapshotId: string,
  parentKey: string,
  options?: ISnapshotChildrenOptions
): Promise<AxiosResponse> {
  if (!snapshotId) {
    throw new Error('Snapshot ID is required');
  }
  if (!parentKey) {
    throw new Error('Parent key is required');
  }

  const params = new URLSearchParams();
  params.append('parentKey', parentKey);
  if (options?.maxNumberOfObjects) params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  if (options?.sortAscending !== undefined) params.append('sortAscending', String(options.sortAscending));
  if (options?.sortByColumnName) params.append('sortByColumnName', options.sortByColumnName);

  const url = `/sap/bc/adt/runtime/memory/snapshots/${snapshotId}/children?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get delta children between two snapshots
 * 
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param parentKey - Parent object key
 * @param options - Children query options
 * @returns Axios response with delta children list
 */
export async function getSnapshotDeltaChildren(
  connection: IAbapConnection,
  uri1: string,
  uri2: string,
  parentKey: string,
  options?: ISnapshotChildrenOptions
): Promise<AxiosResponse> {
  if (!uri1 || !uri2) {
    throw new Error('Both snapshot URIs are required');
  }
  if (!parentKey) {
    throw new Error('Parent key is required');
  }

  const params = new URLSearchParams();
  params.append('uri1', uri1);
  params.append('uri2', uri2);
  params.append('parentKey', parentKey);
  if (options?.maxNumberOfObjects) params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  if (options?.sortAscending !== undefined) params.append('sortAscending', String(options.sortAscending));
  if (options?.sortByColumnName) params.append('sortByColumnName', options.sortByColumnName);

  const url = `/sap/bc/adt/runtime/memory/snapdelta/children?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get references to an object in snapshot
 * 
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @param objectKey - Object key
 * @param options - References query options
 * @returns Axios response with references list
 */
export async function getSnapshotReferences(
  connection: IAbapConnection,
  snapshotId: string,
  objectKey: string,
  options?: ISnapshotReferencesOptions
): Promise<AxiosResponse> {
  if (!snapshotId) {
    throw new Error('Snapshot ID is required');
  }
  if (!objectKey) {
    throw new Error('Object key is required');
  }

  const params = new URLSearchParams();
  params.append('objectKey', objectKey);
  if (options?.maxNumberOfReferences) params.append('maxNumberOfReferences', String(options.maxNumberOfReferences));

  const url = `/sap/bc/adt/runtime/memory/snapshots/${snapshotId}/references?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get delta references between two snapshots
 * 
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @param objectKey - Object key
 * @param options - References query options
 * @returns Axios response with delta references list
 */
export async function getSnapshotDeltaReferences(
  connection: IAbapConnection,
  uri1: string,
  uri2: string,
  objectKey: string,
  options?: ISnapshotReferencesOptions
): Promise<AxiosResponse> {
  if (!uri1 || !uri2) {
    throw new Error('Both snapshot URIs are required');
  }
  if (!objectKey) {
    throw new Error('Object key is required');
  }

  const params = new URLSearchParams();
  params.append('uri1', uri1);
  params.append('uri2', uri2);
  params.append('objectKey', objectKey);
  if (options?.maxNumberOfReferences) params.append('maxNumberOfReferences', String(options.maxNumberOfReferences));

  const url = `/sap/bc/adt/runtime/memory/snapdelta/references?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get snapshot overview
 * 
 * @param connection - ABAP connection
 * @param snapshotId - Snapshot ID
 * @returns Axios response with snapshot overview
 */
export async function getSnapshotOverview(
  connection: IAbapConnection,
  snapshotId: string
): Promise<AxiosResponse> {
  if (!snapshotId) {
    throw new Error('Snapshot ID is required');
  }

  const url = `/sap/bc/adt/runtime/memory/snapshots/${snapshotId}/overview`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get delta overview between two snapshots
 * 
 * @param connection - ABAP connection
 * @param uri1 - URI of first snapshot
 * @param uri2 - URI of second snapshot
 * @returns Axios response with delta overview
 */
export async function getSnapshotDeltaOverview(
  connection: IAbapConnection,
  uri1: string,
  uri2: string
): Promise<AxiosResponse> {
  if (!uri1 || !uri2) {
    throw new Error('Both snapshot URIs are required');
  }

  const params = new URLSearchParams();
  params.append('uri1', uri1);
  params.append('uri2', uri2);

  const url = `/sap/bc/adt/runtime/memory/snapdelta/overview?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

