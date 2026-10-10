/**
 * FunctionModule read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { FUNCTION_MODULE, transportUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import { objectMetadataWire, objectSourceWire } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP function module metadata (without source code)
 */
export async function getFunctionMetadata(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectMetadataWire(
    connection,
    'functionmodule',
    functionName,
    functionGroup,
    options,
  );
}

/**
 * Get ABAP function module source code
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getFunctionSource(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectSourceWire(
    connection,
    'functionmodule',
    functionName,
    functionGroup,
    version,
    options,
  );
}

/**
 * Get transport request for ABAP function module
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @returns Transport request information
 */
export async function getFunctionModuleTransport(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `${transportUri(FUNCTION_MODULE.uri(functionGroup, functionName))}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
