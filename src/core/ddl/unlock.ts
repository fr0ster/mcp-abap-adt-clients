/**
 * View unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DDL_SOURCE } from '../../endpoints/objects';

/**
 * Unlock DDLS
 */
export async function unlockDDLS(
  connection: IAbapConnection,
  ddlName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${DDL_SOURCE.uri(ddlName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: null,
  });
}
