/**
 * Message class unlock operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

/**
 * Unlock a message class after modification.
 *
 * NOTE: Caller should call connection.setSessionType('stateless') after this.
 */
export async function unlockMessageClass(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `${BASE}/${encoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
