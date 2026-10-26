/**
 * Structure unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE } from '../../endpoints/objects';

/**
 * Unlock structure
 * Must use same session and lock handle from lock operation
 */
export async function unlockStructure(
  connection: IAbapConnection,
  structureName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${STRUCTURE.uri(structureName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: null,
  });
}
