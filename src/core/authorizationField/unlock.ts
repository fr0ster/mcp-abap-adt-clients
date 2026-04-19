/**
 * AuthorizationField (SUSO / AUTH) unlock operation
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock authorization field. Must use the same stateful session that owned
 * the lock and the exact lockHandle returned from lockAuthorizationField().
 */
export async function unlockAuthorizationField(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<void> {
  if (!name) {
    throw new Error('Authorization field name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const encoded = encodeSapObjectName(name.toUpperCase());
  const url = `/sap/bc/adt/aps/iam/auth/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
