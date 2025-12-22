/**
 * Domain read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP domain
 * @param connection - ABAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 */
export async function getDomain(
  connection: IAbapConnection,
  domainName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(domainName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/domains/${encodedName}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}

/**
 * Get transport request for ABAP domain
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param options - Optional read options
 * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
 *                                  Useful after create/activate operations to wait until object is ready
 * @returns Transport request information
 */
export async function getDomainTransport(
  connection: IAbapConnection,
  domainName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(domainName);
  let url = `/sap/bc/adt/ddic/domains/${encodedName}/transport`;
  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
