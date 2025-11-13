/**
 * Interface update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockInterfaceForUpdate } from './lock';
import { unlockInterface } from './unlock';
import { activateInterface } from './activation';
import { UpdateInterfaceSourceParams } from './types';

/**
 * Upload interface source code (for update)
 */
async function uploadInterfaceSourceForUpdate(
  connection: AbapConnection,
  interfaceName: string,
  sourceCode: string,
  lockHandle: string,
  sessionId: string,
  corrNr?: string
): Promise<AxiosResponse> {
  let url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}/source/main?lockHandle=${lockHandle}`;
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
 * Update interface source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateInterfaceSource(
  connection: AbapConnection,
  params: UpdateInterfaceSourceParams
): Promise<AxiosResponse> {
  const interfaceName = params.interface_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Lock the interface
    const lockResult = await lockInterfaceForUpdate(connection, interfaceName, sessionId);
    lockHandle = lockResult.lockHandle;
    const corrNr = lockResult.corrNr;

    // Step 2: Upload new source code
    await uploadInterfaceSourceForUpdate(connection, interfaceName, params.source_code, lockHandle, sessionId, corrNr);

    // Step 3: Unlock the interface
    await unlockInterface(connection, interfaceName, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the interface (optional)
    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateInterface(connection, interfaceName, sessionId);
    }

    // Return success response
    return {
      data: {
        success: true,
        interface_name: interfaceName,
        type: 'INTF/OI',
        message: shouldActivate
          ? `Interface ${interfaceName} source updated and activated successfully`
          : `Interface ${interfaceName} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}`,
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
        await unlockInterface(connection, interfaceName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update interface ${interfaceName}: ${errorMessage}`);
  }
}

