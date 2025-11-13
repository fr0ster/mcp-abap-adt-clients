/**
 * Class update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockClassForUpdate } from './lock';
import { unlockClass } from './unlock';
import { activateClass } from './activation';

export interface UpdateClassSourceParams {
  class_name: string;
  source_code: string;
  activate?: boolean;
}

/**
 * Upload class source code (for update)
 */
async function uploadClassSourceForUpdate(
  connection: AbapConnection,
  className: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  corrNr?: string
): Promise<AxiosResponse> {
  let url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}/source/main?lockHandle=${lockHandle}`;
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
 * Update class source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateClassSource(
  connection: AbapConnection,
  params: UpdateClassSourceParams
): Promise<AxiosResponse> {
  const className = params.class_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Lock the class
    const lockResult = await lockClassForUpdate(connection, className, sessionId);
    lockHandle = lockResult.lockHandle;
    const corrNr = lockResult.corrNr;

    // Step 2: Upload new source code
    await uploadClassSourceForUpdate(connection, className, params.source_code, lockHandle, sessionId, corrNr);

    // Step 3: Unlock the class
    await unlockClass(connection, className, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the class (optional)
    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateClass(connection, className, sessionId);
    }

    // Return success response
    return {
      data: {
        success: true,
        class_name: className,
        type: 'CLAS/OC',
        message: shouldActivate
          ? `Class ${className} source updated and activated successfully`
          : `Class ${className} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}`,
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
        await unlockClass(connection, className, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update class ${className}: ${errorMessage}`);
  }
}

