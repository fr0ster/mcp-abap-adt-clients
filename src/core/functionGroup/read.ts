/**
 * FunctionGroup read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(connection: AbapConnection, functionGroupName: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(functionGroupName);
  const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

