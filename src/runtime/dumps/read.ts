/**
 * Runtime Dumps (ABAP Short Dump Analysis)
 *
 * Provides functions for reading ABAP runtime dumps via ADT endpoints:
 * - List dumps feed with paging/query options
 * - List dumps by user
 * - Read dump by URI
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

export interface IRuntimeDumpsListOptions {
  query?: string;
  inlinecount?: 'allpages' | 'none';
  top?: number;
  skip?: number;
  orderby?: string;
}

function appendIfDefined(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
): void {
  if (value === undefined || value === null || value === '') {
    return;
  }
  params.set(key, String(value));
}

/**
 * Build ADT runtime dumps query expression for user filtering.
 *
 * @example and( equals( user, CB9980000423 ) )
 */
export function buildRuntimeDumpsUserQuery(user?: string): string | undefined {
  const normalized = user?.trim();
  if (!normalized) {
    return undefined;
  }
  return `and( equals( user, ${normalized} ) )`;
}

/**
 * List runtime dumps feed.
 */
export async function listRuntimeDumps(
  connection: IAbapConnection,
  options: IRuntimeDumpsListOptions = {},
): Promise<AxiosResponse> {
  const params = new URLSearchParams();

  appendIfDefined(params, '$query', options.query);
  appendIfDefined(params, '$inlinecount', options.inlinecount);
  appendIfDefined(params, '$top', options.top);
  appendIfDefined(params, '$skip', options.skip);
  appendIfDefined(params, '$orderby', options.orderby);

  const query = params.toString();
  const url = `/sap/bc/adt/runtime/dumps${query ? `?${query}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

/**
 * List runtime dumps filtered by user.
 */
export async function listRuntimeDumpsByUser(
  connection: IAbapConnection,
  user?: string,
  options: Omit<IRuntimeDumpsListOptions, 'query'> = {},
): Promise<AxiosResponse> {
  return listRuntimeDumps(connection, {
    ...options,
    query: buildRuntimeDumpsUserQuery(user),
  });
}

/**
 * Read a specific runtime dump by its ADT URI.
 */
export async function getRuntimeDumpByUri(
  connection: IAbapConnection,
  uri: string,
): Promise<AxiosResponse> {
  const normalized = uri?.trim();
  if (!normalized) {
    throw new Error('Runtime dump URI is required');
  }

  return connection.makeAdtRequest({
    url: normalized,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
