/**
 * FunctionInclude (FUGR/I) unlock operation.
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock function include. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockFunctionInclude().
 */
export async function unlockFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_INCLUDE.uri(groupName, includeName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
