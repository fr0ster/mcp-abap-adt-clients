/**
 * Interface update operations - Low-level function
 * Use AdtInterface.update() for high-level operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { INTERFACE, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Low-level: Upload interface source code (PUT)
 * Requires lock handle - does NOT lock/unlock
 */
export async function upload(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  interfaceName: string,
  sourceCode: string,
  lockHandle: string,
  corrNr: string | undefined,
): Promise<IAdtWireResponse> {
  let url = `${sourceUri(INTERFACE.uri(interfaceName))}?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }
  // The answer is returned rather than discarded: what a write becomes is the
  // consumer's result strategy to decide, and a function that swallowed it left
  // that strategy nothing to read.
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: requestHeaders(headers),
  });
}
