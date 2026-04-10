/**
 * GatewayErrorLog - Low-level read functions
 *
 * Provides access to SAP Gateway error log (/IWFND/ERROR_LOG):
 * - List gateway errors with optional filtering
 * - Get individual error details by type and ID
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
 * List gateway errors
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with gateway error log feed
 */
export async function listGatewayErrors(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/gw/errorlog${buildQueryParams(options)}`;

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
 * Get a single gateway error by type and ID
 *
 * @param connection - ABAP connection
 * @param errorType - Error type (e.g. 'Frontend Error')
 * @param errorId - Error transaction ID
 * @returns Axios response with gateway error details
 */
export async function getGatewayError(
  connection: IAbapConnection,
  errorType: string,
  errorId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/gw/errorlog/${encodeURIComponent(errorType)}/${errorId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
