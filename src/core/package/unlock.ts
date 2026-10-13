/**
 * Package unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { PACKAGE } from '../../endpoints/objects';

/**
 * Unlock package
 * Must use same lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockPackage(
  connection: IAbapConnection,
  packageName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${PACKAGE.uri(packageName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: null,
  });
}
