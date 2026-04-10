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
  IFeedQueryOptions,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { buildFeedQueryParams } from '../feeds/read';

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
  const url = `/sap/bc/adt/runtime/systemmessages${buildFeedQueryParams(options)}`;

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
