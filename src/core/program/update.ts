/**
 * Program update operations - low-level functions for AdtProgram
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { PROGRAM, sourceUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Upload program source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtProgram
 */
export async function uploadProgramSource(
  connection: IAbapConnection,
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

  const headers = {
    'Content-Type': CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
  });
}
