/**
 * FunctionInclude (FUGR/I) unlock operation.
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
): Promise<void> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
