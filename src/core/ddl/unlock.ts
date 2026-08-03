/**
 * View unlock operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock DDLS
 */
export async function unlockDDLS(
  connection: IAbapConnection,
  ddlName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(ddlName).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
