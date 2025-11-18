/**
 * FunctionGroup create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../shared/systemInfo';
import { activateFunctionGroup } from './activation';
import { CreateFunctionGroupParams } from './types';

/**
 * Create function group metadata via POST
 */
async function createFunctionGroupObject(
  connection: AbapConnection,
  functionGroupName: string,
  description: string,
  packageName: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/functions/groups${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  // Get masterSystem and responsible (only for cloud systems)
  // On cloud, getSystemInformation returns systemID and userName
  // On on-premise, it returns null, so we don't add these attributes
  const systemInfo = await getSystemInformation(connection);
  const masterSystem = systemInfo?.systemID;
  const username = systemInfo?.userName || process.env.SAP_USERNAME || process.env.SAP_USER || '';

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<group:abapFunctionGroup xmlns:group="http://www.sap.com/adt/functions/groups" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${functionGroupName}" adtcore:type="FUGR/F" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${packageName}"/>
</group:abapFunctionGroup>`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.sap.adt.functions.groups.v3+xml',
    'Accept': 'application/vnd.sap.adt.functions.groups.v3+xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });
}

/**
 * Create ABAP function group
 * Full workflow: create -> activate (optional)
 */
export async function createFunctionGroup(
  connection: AbapConnection,
  params: CreateFunctionGroupParams
): Promise<AxiosResponse> {
  if (!params.function_group_name || !params.package_name) {
    throw new Error('function_group_name and package_name are required');
  }

  if (params.function_group_name.length > 26) {
    throw new Error('Function group name must not exceed 26 characters');
  }

  if (!/^[ZY]/i.test(params.function_group_name)) {
    throw new Error('Function group name must start with Z or Y (customer namespace)');
  }

  try {
    const createResponse = await createFunctionGroupObject(
      connection,
      params.function_group_name,
      params.description || params.function_group_name,
      params.package_name,
      params.transport_request
    );

    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateFunctionGroup(connection, params.function_group_name);
    }

    // Return the real response from SAP (from initial POST)
    return createResponse;

  } catch (error: any) {
    let errorMessage = `Failed to create function group: ${error}`;

    if (error.response?.status === 400) {
      errorMessage = `Bad request. Check if function group name is valid and package exists.`;
    } else if (error.response?.status === 409) {
      errorMessage = `Function group ${params.function_group_name} already exists.`;
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

