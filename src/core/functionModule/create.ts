/**
 * FunctionModule create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { getSystemInformation } from '../shared/systemInfo';
import { lockFunctionModule } from './lock';
import { unlockFunctionModule } from './unlock';
import { activateFunctionModule } from './activation';
import { CreateFunctionModuleParams } from './types';
import { getFunctionGroup } from '../functionGroup/read';
import { createFunctionGroup } from '../functionGroup/create';
import { validateFunctionModuleName } from './validation';
import { validateAndThrow } from '../shared/validation';

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

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:name="${functionModuleName}" adtcore:type="FUGR/FF"${masterSystemAttr}${responsibleAttr}>
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

  // Validate function module name with SAP validation endpoint
  const validationResult = await validateFunctionModuleName(
    connection,
    params.function_group_name,
    params.function_module_name,
    params.description || params.function_module_name
  );
  await validateAndThrow(validationResult, 'Function module');

  const sessionId = generateSessionId();
  let lockHandle: string | undefined;

  try {
    // Ensure function group exists. If not found and package_name is provided, try to create it.
    try {
      await getFunctionGroup(connection, params.function_group_name);
    } catch (err: any) {
      // If not found (404) and package_name provided, create function group automatically
      if (err.response?.status === 404) {
        if (params.package_name) {
          await createFunctionGroup(connection, {
            function_group_name: params.function_group_name,
            package_name: params.package_name,
            description: params.description || params.function_group_name,
            transport_request: params.transport_request,
            activate: false
          });
        } else {
          throw new Error(`Function group ${params.function_group_name} not found. Create the function group first or provide package_name to auto-create it.`);
        }
      } else {
        throw err;
      }
    }

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

