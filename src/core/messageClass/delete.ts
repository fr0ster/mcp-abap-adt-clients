/**
 * Message class delete operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

/**
 * Delete a message class.
 * DELETE /sap/bc/adt/messageclass/{name}?lockHandle={lh}
 *
 * NOTE: Caller must enable stateful session and hold a valid lockHandle.
 *       Caller must call setSessionType('stateless') after this.
 */
export async function deleteMessageClass(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `${BASE}/${encoded}?lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    timeout: getTimeout('default'),
    data: null,
  });
}
