/**
 * Table read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP table structure
 */
export async function getTable(connection: AbapConnection, tableName: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(tableName);
  const url = `${baseUrl}/sap/bc/adt/ddic/tables/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

