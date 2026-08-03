/**
 * Table unlock operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock the table after DDL content is added
 * Must use same session and lock handle from lock operation
 */
export async function unlockTable(
  connection: IAbapConnection,
  tableName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: {},
  });
}

/**
 * Delete table lock (cleanup)
 */
export async function deleteTableLock(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${encodeSapObjectName(tableName)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {},
  });
}
