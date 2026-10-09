/**
 * Memory snapshots: one function per request, as measured.
 *
 * A snapshot is written by the debugger (`createMemorySnapshot` in
 * `runtime/debugger/abap.ts`) and read here once ADT lists it. Every view
 * answers 406 to `application/xml` and names the one type it serves; those
 * types are below. Measured on the cloud (2026-10-09) on two snapshots of
 * one debuggee, before and after it filled a table: the delta ranking list
 * put that table first, marked `added`. A snapshot id that does not exist is
 * answered 404 `MEMORY_INSPECTOR 010`. The ranking list, children and
 * references take a required limit: without it they answer 400 "Parameter …
 * could not be found", on premise and cloud alike (2026-10-10).
 *
 * A user not authorized to display snapshots is answered 200 and an empty
 * list, not 403: on premise the list stayed empty while snapshots were
 * written, until a role granted the display (2026-10-10).
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';
import type {
  ISnapshotChildrenOptions,
  ISnapshotRankingListOptions,
  ISnapshotReferencesOptions,
} from '../debugger/contracts';

const MEMORY = '/sap/bc/adt/runtime/memory';
const TYPE = 'application/vnd.sap.adt.runtime.memory';

/** The one type each view answers in. */
export const MEMORY_SNAPSHOT_ACCEPT = {
  list: `${TYPE}.snapshots.v1+xml`,
  snapshot: `${TYPE}.snapshot.v1+xml`,
  overview: `${TYPE}.overview.v1+xml`,
  rankingList: `${TYPE}.rankinglist.v1+xml`,
  children: `${TYPE}.children.v1+xml`,
  references: `${TYPE}.references.v1+xml`,
} as const;

/** The URI a delta names a snapshot by. */
export function snapshotUri(snapshotId: string): string {
  return `${MEMORY}/snapshots/${encodeURIComponent(snapshotId)}`;
}

function get(
  connection: IAbapConnection,
  path: string,
  params: URLSearchParams,
  accept: string,
): Promise<IAdtWireResponse> {
  const search = params.toString();
  return connection.makeAdtRequest({
    url: `${MEMORY}/${path}${search ? `?${search}` : ''}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: accept },
  });
}

function deltaParams(fromId: string, toId: string): URLSearchParams {
  return new URLSearchParams({
    uri1: snapshotUri(fromId),
    uri2: snapshotUri(toId),
  });
}

function rankingParams(
  params: URLSearchParams,
  options: ISnapshotRankingListOptions,
): URLSearchParams {
  params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  for (const type of options.excludeAbapType ?? [])
    params.append('excludeAbapType', type);
  if (options.sortAscending !== undefined)
    params.append('sortAscending', String(options.sortAscending));
  if (options.sortByColumnName)
    params.append('sortByColumnName', options.sortByColumnName);
  if (options.groupByParentType !== undefined)
    params.append('groupByParentType', String(options.groupByParentType));
  return params;
}

function childrenParams(
  params: URLSearchParams,
  parentKey: string,
  options: ISnapshotChildrenOptions,
): URLSearchParams {
  params.append('parentKey', parentKey);
  params.append('maxNumberOfObjects', String(options.maxNumberOfObjects));
  if (options.sortAscending !== undefined)
    params.append('sortAscending', String(options.sortAscending));
  if (options.sortByColumnName)
    params.append('sortByColumnName', options.sortByColumnName);
  return params;
}

function referencesParams(
  params: URLSearchParams,
  objectKey: string,
  options: ISnapshotReferencesOptions,
): URLSearchParams {
  params.append('objectKey', objectKey);
  params.append('maxNumberOfReferences', String(options.maxNumberOfReferences));
  return params;
}

/**
 * The snapshots ADT lists. A snapshot written by the debugger appears here
 * only later — on the cloud a few minutes after it was written.
 */
export async function listSnapshots(
  connection: IAbapConnection,
  user?: string,
  originalUser?: string,
): Promise<IAdtWireResponse> {
  const params = new URLSearchParams();
  if (user) params.append('user', user);
  if (originalUser) params.append('originalUser', originalUser);
  return get(connection, 'snapshots', params, MEMORY_SNAPSHOT_ACCEPT.list);
}

/** One snapshot's header: its file, server, program, sizes. */
export async function getSnapshot(
  connection: IAbapConnection,
  snapshotId: string,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    `snapshots/${encodeURIComponent(snapshotId)}`,
    new URLSearchParams(),
    MEMORY_SNAPSHOT_ACCEPT.snapshot,
  );
}

/** Roll memory and the number of objects per ABAP type. */
export async function getSnapshotOverview(
  connection: IAbapConnection,
  snapshotId: string,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    `snapshots/${encodeURIComponent(snapshotId)}/overview`,
    new URLSearchParams(),
    MEMORY_SNAPSHOT_ACCEPT.overview,
  );
}

/** The memory objects by size; each carries the `key` the views below take. */
export async function getSnapshotRankingList(
  connection: IAbapConnection,
  snapshotId: string,
  options: ISnapshotRankingListOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    `snapshots/${encodeURIComponent(snapshotId)}/rankinglist`,
    rankingParams(new URLSearchParams(), options),
    MEMORY_SNAPSHOT_ACCEPT.rankingList,
  );
}

export async function getSnapshotChildren(
  connection: IAbapConnection,
  snapshotId: string,
  parentKey: string,
  options: ISnapshotChildrenOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    `snapshots/${encodeURIComponent(snapshotId)}/children`,
    childrenParams(new URLSearchParams(), parentKey, options),
    MEMORY_SNAPSHOT_ACCEPT.children,
  );
}

/** What holds an object: the variables that reference it. */
export async function getSnapshotReferences(
  connection: IAbapConnection,
  snapshotId: string,
  objectKey: string,
  options: ISnapshotReferencesOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    `snapshots/${encodeURIComponent(snapshotId)}/references`,
    referencesParams(new URLSearchParams(), objectKey, options),
    MEMORY_SNAPSHOT_ACCEPT.references,
  );
}

/** The overview of `toId`, each value with its change from `fromId`. */
export async function getSnapshotDeltaOverview(
  connection: IAbapConnection,
  fromId: string,
  toId: string,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    'snapdelta/overview',
    deltaParams(fromId, toId),
    MEMORY_SNAPSHOT_ACCEPT.overview,
  );
}

/** The objects that changed, each marked `added` or otherwise. */
export async function getSnapshotDeltaRankingList(
  connection: IAbapConnection,
  fromId: string,
  toId: string,
  options: ISnapshotRankingListOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    'snapdelta/rankinglist',
    rankingParams(deltaParams(fromId, toId), options),
    MEMORY_SNAPSHOT_ACCEPT.rankingList,
  );
}

export async function getSnapshotDeltaChildren(
  connection: IAbapConnection,
  fromId: string,
  toId: string,
  parentKey: string,
  options: ISnapshotChildrenOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    'snapdelta/children',
    childrenParams(deltaParams(fromId, toId), parentKey, options),
    MEMORY_SNAPSHOT_ACCEPT.children,
  );
}

export async function getSnapshotDeltaReferences(
  connection: IAbapConnection,
  fromId: string,
  toId: string,
  objectKey: string,
  options: ISnapshotReferencesOptions,
): Promise<IAdtWireResponse> {
  return get(
    connection,
    'snapdelta/references',
    referencesParams(deltaParams(fromId, toId), objectKey, options),
    MEMORY_SNAPSHOT_ACCEPT.references,
  );
}
