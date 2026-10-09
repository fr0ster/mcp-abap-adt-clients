/**
 * Program unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { PROGRAM } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
export async function unlockProgram(
  connection: IAbapConnection,
  programName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${PROGRAM.uri(programName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
