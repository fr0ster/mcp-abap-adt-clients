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
  const encodedName = encodeSapObjectName(functionGroupName);
  const url = `/sap/bc/adt/functions/groups/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Get transport request for ABAP function group
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @returns Transport request information
 */
export async function getFunctionGroupTransport(
  connection: AbapConnection,
  functionGroupName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(functionGroupName);
  const url = `/sap/bc/adt/functions/groups/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

