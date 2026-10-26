/**
 * Behavior Implementation update operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS_INCLUDE } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Update behavior implementation class implementations include source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateBehaviorImplementation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  className: string,
  sourceCode: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const url = `${CLASS_INCLUDE.uri(className, 'implementations')}${writeQuery(lockHandle, transportRequest)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: requestHeaders(headers),
  });
}
