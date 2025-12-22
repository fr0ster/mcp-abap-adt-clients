/**
 * FunctionGroup read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(functionGroupName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/functions/groups/${encodedName}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
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
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(functionGroupName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/functions/groups/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
