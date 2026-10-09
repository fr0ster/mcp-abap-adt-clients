/**
 * Class unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock class
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockClass(
  connection: IAbapConnection,
  className: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${CLASS.uri(className)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
