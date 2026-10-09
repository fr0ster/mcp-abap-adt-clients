/**
 * AuthorizationField (SUSO / AUTH) unlock operation
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock authorization field. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockAuthorizationField().
 */
export async function unlockAuthorizationField(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${AUTHORIZATION_FIELD.uri(name)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
