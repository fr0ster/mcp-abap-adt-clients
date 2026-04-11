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
  IFeedQueryOptions,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { buildFeedQueryParams } from '../feeds/read';

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
  const url = `/sap/bc/adt/gw/errorlog${buildFeedQueryParams(options, 'username')}`;

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
