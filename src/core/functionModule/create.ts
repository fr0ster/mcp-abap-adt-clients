/**
 * FunctionModule create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockFunctionModule } from './lock';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { CreateFunctionModuleParams } from './types';

/**
 * Create function module metadata
 */
async function createFunctionModuleMetadata(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  description: string,
  corrNr: string | undefined
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();

  let url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules${corrNr ? `?corrNr=${corrNr}` : ''}`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:name="${functionModuleName}" adtcore:type="FUGR/FF">
  <adtcore:containerRef adtcore:name="${functionGroupName}" adtcore:type="FUGR/F" adtcore:uri="/sap/bc/adt/functions/groups/${encodedGroupName}"/>
</fmodule:abapFunctionModule>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      'Content-Type': 'application/vnd.sap.adt.functions.fmodules+xml',
      'Accept': 'application/vnd.sap.adt.functions.fmodules+xml'
    }
  });
}

/**
 * Upload function module source code
 */
async function uploadFunctionModuleSource(
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
 * Create ABAP function module
 * Full workflow: create metadata -> lock -> upload source -> unlock -> activate
 */
export async function createFunctionModule(
  connection: AbapConnection,
  params: CreateFunctionModuleParams
): Promise<AxiosResponse> {
  if (!params.function_group_name || !params.function_module_name || !params.source_code) {
    throw new Error('function_group_name, function_module_name, and source_code are required');
  }

  if (params.function_module_name.length > 30) {
    throw new Error('Function module name must not exceed 30 characters');
  }

  if (!/^[ZY]/i.test(params.function_module_name)) {
    throw new Error('Function module name must start with Z or Y (customer namespace)');
  }

  const sessionId = generateSessionId();
  let lockHandle: string | undefined;

  try {
    await createFunctionModuleMetadata(
      connection,
      params.function_group_name,
      params.function_module_name,
      params.description || params.function_module_name,
      params.transport_request
    );

    lockHandle = await lockFunctionModule(connection, params.function_group_name, params.function_module_name, sessionId);

    await uploadFunctionModuleSource(
      connection,
      params.function_group_name,
      params.function_module_name,
      lockHandle,
      params.transport_request,
      params.source_code,
      sessionId
    );

    await unlockFunctionModule(connection, params.function_group_name, params.function_module_name, lockHandle, sessionId);
    lockHandle = undefined;

    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateFunctionModule(connection, params.function_group_name, params.function_module_name, sessionId);
    }

    return {
      data: {
        success: true,
        function_module_name: params.function_module_name,
        function_group_name: params.function_group_name,
        transport_request: params.transport_request || 'local',
        activated: shouldActivate,
        message: `Function module ${params.function_module_name} created successfully${shouldActivate ? ' and activated' : ''}`
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockFunctionModule(connection, params.function_group_name, params.function_module_name, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    let errorMessage = `Failed to create function module: ${error}`;

    if (error.response?.status === 400) {
      errorMessage = `Bad request. Check if function module name is valid and function group exists.`;
    } else if (error.response?.status === 404) {
      errorMessage = `Function group ${params.function_group_name} not found. Create the function group first.`;
    } else if (error.response?.status === 409) {
      errorMessage = `Function module ${params.function_module_name} already exists in group ${params.function_group_name}.`;
    } else if (error.response?.data && typeof error.response.data === 'string') {
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_'
        });
        const errorData = parser.parse(error.response.data);
        const errorMsg = errorData['exc:exception']?.message?.['#text'] || errorData['exc:exception']?.message;
        if (errorMsg) {
          errorMessage = `SAP Error: ${errorMsg}`;
        }
      } catch (parseError) {
        // Ignore parse errors, use default message
      }
    }

    throw new Error(errorMessage);
  }
}

