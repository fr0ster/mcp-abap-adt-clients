/**
 * Domain read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_DOMAIN, ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { DOMAIN, transportUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

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
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${DOMAIN.uri(domainName)}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_DOMAIN,
    },
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
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  let url = `${transportUri(DOMAIN.uri(domainName))}`;
  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
