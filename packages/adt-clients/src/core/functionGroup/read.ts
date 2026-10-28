/**
 * FunctionGroup read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { FUNCTION_GROUP, transportUri } from '../../endpoints/objects';
import { getObjectSourceUri } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${FUNCTION_GROUP.uri(functionGroupName)}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? '*/*' },
  });
}

/**
 * Get ABAP function group source (the function pool's main program)
 */
export async function getFunctionGroupSource(
  connection: IAbapConnection,
  functionGroupName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  let url = getObjectSourceUri('FUGR/F', functionGroupName, undefined, version);
  if (options?.withLongPolling) {
    url += `${url.includes('?') ? '&' : '?'}withLongPolling=true`;
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? 'text/plain' },
  });
}

/**
 * Get transport request for ABAP function group
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @returns Transport request information
 */
export async function getFunctionGroupTransport(
  connection: IAbapConnection,
  functionGroupName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(FUNCTION_GROUP.uri(functionGroupName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
