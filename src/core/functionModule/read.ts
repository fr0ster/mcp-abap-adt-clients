/**
 * FunctionModule read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP function module source code
 * @param connection - SAP connection
 * @param functionName - Function module name
 * @param functionGroup - Function group name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getFunction(
  connection: AbapConnection,
  functionName: string,
  functionGroup: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const versionParam = version === 'inactive' ? '?version=inactive' : '';
  const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Get ABAP function module metadata
 */
export async function getFunctionMetadata(
  connection: AbapConnection,
  functionName: string,
  functionGroup: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}
