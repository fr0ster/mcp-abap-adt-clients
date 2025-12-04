/**
 * FunctionModule read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP function module metadata (without source code)
 */
export async function getFunctionMetadata(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'functionmodule', functionName, functionGroup);
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'functionmodule', functionName, functionGroup, version);
}

/**
 * Get ABAP function module (source code by default for backward compatibility)
 * @deprecated Use getFunctionSource() or getFunctionMetadata() instead
 */
export async function getFunction(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
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
  functionGroup: string
): Promise<AxiosResponse> {
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}
