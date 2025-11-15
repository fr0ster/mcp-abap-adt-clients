/**
 * FunctionModule read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP function module metadata (without source code)
 */
export async function getFunctionMetadata(
  connection: AbapConnection,
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
  connection: AbapConnection,
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
  connection: AbapConnection,
  functionName: string,
  functionGroup: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return getFunctionSource(connection, functionName, functionGroup, version);
}
