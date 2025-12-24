/**
 * Feed Reader
 *
 * Provides functions for accessing feed repository:
 * - Get feeds
 * - Get feed variants
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get feeds
 *
 * @param connection - ABAP connection
 * @returns Axios response with feeds
 */
export async function getFeeds(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/feeds`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get feed variants
 *
 * @param connection - ABAP connection
 * @returns Axios response with feed variants
 */
export async function getFeedVariants(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/feeds/variants`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
