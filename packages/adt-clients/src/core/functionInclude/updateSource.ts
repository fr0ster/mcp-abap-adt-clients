/**
 * FunctionInclude (FUGR/I) source upload operations.
 *
 * Requires a valid lockHandle (acquired via lockFunctionInclude).
 * Does NOT lock/unlock — assumes the object is already locked.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_INCLUDE, sourceUri } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Upload function include source code (low-level; uses an existing lockHandle).
 *
 * @param unicode when true, Content-Type is "text/plain; charset=utf-8";
 *                when false, plain "text/plain" (for legacy non-unicode systems).
 */
export async function uploadFunctionIncludeSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  groupName: string,
  includeName: string,
  sourceCode: string,
  lockHandle: string | undefined,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(FUNCTION_INCLUDE.uri(groupName, includeName))}${writeQuery(lockHandle, transportRequest)}`;

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
