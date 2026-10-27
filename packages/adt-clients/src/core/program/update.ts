/**
 * Program update operations - low-level functions for AdtProgram
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { PROGRAM, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Upload program source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtProgram
 */
export async function uploadProgramSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  programName: string,
  sourceCode: string,
  lockHandle: string,
  _sessionId: string,
  corrNr?: string,
) {
  let url = `${sourceUri(PROGRAM.uri(programName))}?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: requestHeaders(headers),
  });
}
