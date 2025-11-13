/**
 * Table unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock the table after DDL content is added
 */
export async function unlockTable(
  connection: AbapConnection,
  tableName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}?_action=UNLOCK&lockHandle=${lockHandle}`;

  const baseUrl = await connection.getBaseUrl();
  const fullUrl = `${baseUrl}${url}`;

  const headers: Record<string, string> = {
    'User-Agent': 'mcp-abap-adt/1.1.0',
    'X-sap-adt-profiling': 'server-time'
  };

  return connection.makeAdtRequest({
    url: fullUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers
  });
}

/**
 * Delete table lock (cleanup)
 */
export async function deleteTableLock(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${encodeSapObjectName(tableName)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {}
  });
}

