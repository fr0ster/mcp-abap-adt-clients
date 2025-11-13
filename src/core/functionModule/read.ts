/**
 * FunctionModule read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP function module
 */
export async function getFunction(
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

