/**
 * FunctionModule read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
 * Get ABAP function module (source code by default for backward compatibility)
 * @deprecated Use getFunctionSource() or getFunctionMetadata() instead
 */
export async function getFunction(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
  version: 'active' | 'inactive' = 'active',
): Promise<IAdtWireResponse> {
  return getFunctionSource(connection, functionName, functionGroup, version);
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
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
