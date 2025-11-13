/**
 * FunctionModule update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockFunctionModuleForUpdate } from './lock';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { UpdateFunctionModuleSourceParams } from './types';

/**
 * Upload function module source code (for update)
 */
async function uploadFunctionModuleSourceForUpdate(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  lockHandle: string,
  corrNr: string | undefined,
  sourceCode: string,
  sessionId: string
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();

  let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, sourceCode, headers);
}

/**
 * Update function module source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateFunctionModuleSource(
  connection: AbapConnection,
  params: UpdateFunctionModuleSourceParams
): Promise<AxiosResponse> {
  const functionModuleName = params.function_module_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    const lockResult = await lockFunctionModuleForUpdate(connection, params.function_group_name, functionModuleName, sessionId);
    lockHandle = lockResult.lockHandle;
    const corrNr = lockResult.corrNr;

    await uploadFunctionModuleSourceForUpdate(connection, params.function_group_name, functionModuleName, lockHandle, corrNr, params.source_code, sessionId);

    await unlockFunctionModule(connection, params.function_group_name, functionModuleName, lockHandle, sessionId);
    lockHandle = null;

    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateFunctionModule(connection, params.function_group_name, functionModuleName, sessionId);
    }

    return {
      data: {
        success: true,
        function_module_name: functionModuleName,
        function_group_name: params.function_group_name,
        type: 'FUGR/FF',
        message: shouldActivate
          ? `Function module ${functionModuleName} source updated and activated successfully`
          : `Function module ${functionModuleName} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/functions/groups/${encodeSapObjectName(params.function_group_name).toLowerCase()}/fmodules/${encodeSapObjectName(functionModuleName).toLowerCase()}`,
        source_size_bytes: params.source_code.length
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockFunctionModule(connection, params.function_group_name, functionModuleName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update function module ${functionModuleName}: ${errorMessage}`);
  }
}

