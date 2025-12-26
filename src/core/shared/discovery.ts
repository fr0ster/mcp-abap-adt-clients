/**
 * ADT discovery endpoint access
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { randomUUID } from 'crypto';
import { getTimeout } from '../../utils/timeouts';
import type { IGetDiscoveryParams } from './types';

/**
 * Fetch ADT discovery document (endpoint catalog)
 *
 * @param connection - ABAP connection
 * @param params - Optional request/timeout options
 * @returns Discovery XML response
 */
export async function getDiscovery(
  connection: IAbapConnection,
  params: IGetDiscoveryParams = {},
): Promise<AxiosResponse> {
  const requestId = params.requestId ?? randomUUID().replace(/-/g, '');
  const timeout = params.timeout ?? getTimeout('default');

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/discovery',
    method: 'GET',
    timeout,
    headers: {
      Accept: 'application/atomsvc+xml',
      'sap-adt-request-id': requestId,
    },
  });
}
