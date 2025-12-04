/**
 * FunctionGroup read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(connection: IAbapConnection, functionGroupName: string): Promise<AxiosResponse> {
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
  connection: IAbapConnection,
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

