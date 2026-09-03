/**
 * Unlock Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=UNLOCK&lockHandle={lockHandle}
 *
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock a metadata extension after editing
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param lockHandle - Lock handle obtained from lockMetadataExtension
 * @returns Axios response
 *
 * @example
 * ```typescript
 * await unlockMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', lockHandle);
 * connection.setSessionType("stateless");
 * ```
 */
export async function unlockMetadataExtension(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const lowerName = encodeSapObjectName(name).toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
