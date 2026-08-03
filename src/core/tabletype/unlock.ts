/**
 * TableType unlock operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock the table type after DDL content is added
 * Must use same session and lock handle from lock operation
 */
export async function unlockTableType(
  connection: IAbapConnection,
  tableTypeName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: {},
  });
}

/**
 * Delete table type lock (cleanup)
 */
export async function deleteTableTypeLock(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/ddlock/locks?lockAction=DELETE&name=${encodeSapObjectName(tableTypeName)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {},
  });
}
