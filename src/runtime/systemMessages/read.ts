/**
 * SystemMessages - Low-level read functions
 *
 * Provides access to system messages (SM02):
 * - List system messages with optional filtering
 * - Get individual system message by ID
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { IFeedQueryOptions } from '../feeds/types';

function buildQueryParams(options?: IFeedQueryOptions): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.user) {
    params.set('$query', `and( equals( user, ${options.user.trim()} ) )`);
  }
  if (options.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * List system messages
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with system messages feed
 */
export async function listSystemMessages(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/systemmessages${buildQueryParams(options)}`;

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
 * Get a single system message by ID
 *
 * @param connection - ABAP connection
 * @param messageId - System message ID
 * @returns Axios response with system message details
 */
export async function getSystemMessage(
  connection: IAbapConnection,
  messageId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/systemmessages/${messageId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
