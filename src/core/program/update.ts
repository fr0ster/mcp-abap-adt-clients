/**
 * Program update operations - low-level functions for ProgramBuilder
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateProgramSourceParams } from './types';

/**
 * Upload program source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by ProgramBuilder
 */
export async function uploadProgramSource(
  connection: IAbapConnection,
  programName: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  corrNr?: string
) {
  let url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return await connection.makeAdtRequest({url, method: 'PUT', timeout: getTimeout('default'), data: sourceCode, headers});
}

