/**
 * Table unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock the table after DDL content is added
 * Must use same session and lock handle from lock operation
 */
export async function unlockTable(
  connection: AbapConnection,
  tableName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: {}
  });
}

/**
 * Delete table lock (cleanup)
 */
export async function deleteTableLock(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${encodeSapObjectName(tableName)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {}
  });
}

