/**
 * Program update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockProgramForUpdate } from './lock';
import { unlockProgram } from './unlock';
import { activateProgram } from './activation';

export interface UpdateProgramSourceParams {
  program_name: string;
  source_code: string;
  activate?: boolean;
}

/**
 * Upload program source code (for update)
 */
async function uploadProgramSourceForUpdate(
  connection: AbapConnection,
  programName: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  corrNr?: string
): Promise<AxiosResponse> {
  let url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return await makeAdtRequestWithSession(connection, url, 'PUT', sessionId, sourceCode, headers);
}

/**
 * Update program source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateProgramSource(
  connection: AbapConnection,
  params: UpdateProgramSourceParams
): Promise<AxiosResponse> {
  const programName = params.program_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Lock the program
    const lockResult = await lockProgramForUpdate(connection, programName, sessionId);
    lockHandle = lockResult.lockHandle;
    const corrNr = lockResult.corrNr;

    // Step 2: Upload new source code
    await uploadProgramSourceForUpdate(connection, programName, params.source_code, lockHandle, sessionId, corrNr);

    // Step 3: Unlock the program
    await unlockProgram(connection, programName, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the program (optional)
    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateProgram(connection, programName, sessionId);
    }

    // Return success response
    return {
      data: {
        success: true,
        program_name: programName,
        type: 'PROG/P',
        message: shouldActivate
          ? `Program ${programName} source updated and activated successfully`
          : `Program ${programName} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}`,
        source_size_bytes: params.source_code.length
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    // CRITICAL: Always try to unlock on error to prevent locked objects
    if (lockHandle) {
      try {
        await unlockProgram(connection, programName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update program ${programName}: ${errorMessage}`);
  }
}

