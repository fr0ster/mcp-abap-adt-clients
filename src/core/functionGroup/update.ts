/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly, but metadata can be updated.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';
import { getFunctionGroup } from './read';
import { lockFunctionGroup } from './lock';
import { unlockFunctionGroup } from './unlock';
import { IUpdateFunctionGroupParams } from './types';

/**
 * Update function group metadata via PUT
 */
async function updateFunctionGroupMetadata(
  connection: IAbapConnection,
  functionGroupName: string,
  currentXml: string,
  newDescription: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(functionGroupName);

  const url = `/sap/bc/adt/functions/groups/${encodedName}${lockHandle ? `?lockHandle=${lockHandle}` : ''}${transportRequest ? `${lockHandle ? '&' : '?'}corrNr=${transportRequest}` : ''}`;

  // Parse current XML to update description
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false
  });

  const parsedXml = parser.parse(currentXml);
  const functionGroup = parsedXml['group:abapFunctionGroup'];

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(newDescription);
  // Update description
  if (functionGroup) {
    functionGroup['@_adtcore:description'] = limitedDescription;
  }

  // Rebuild XML (simplified - use original XML with replaced description)
  const updatedXml = currentXml.replace(
    /adtcore:description="[^"]*"/,
    `adtcore:description="${limitedDescription}"`
  );

  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.sap.adt.functions.groups.v3+xml; charset=utf-8',
    'Accept': 'application/vnd.sap.adt.functions.groups.v3+xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: updatedXml,
    headers
  });
}

/**
 * Update function group metadata (description)
 * Full workflow: lock -> get current -> update -> unlock
 */
export async function updateFunctionGroup(
  connection: IAbapConnection,
  params: IUpdateFunctionGroupParams
): Promise<AxiosResponse> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }

  if (!params.description) {
    throw new Error('description is required for update');
  }

  let lockHandle = params.lock_handle;
  let shouldUnlock = false;

  try {
    // Lock if not already locked
    if (!lockHandle) {
      lockHandle = await lockFunctionGroup(connection, params.function_group_name);
      shouldUnlock = true;
    }

    if (!lockHandle) {
      throw new Error('Failed to acquire lock handle');
    }

    // Get current XML
    const currentResponse = await getFunctionGroup(connection, params.function_group_name);
    const currentXml = typeof currentResponse.data === 'string'
      ? currentResponse.data
      : JSON.stringify(currentResponse.data);

    // Update metadata
    const updateResponse = await updateFunctionGroupMetadata(
      connection,
      params.function_group_name,
      currentXml,
      params.description,
      lockHandle,
      params.transport_request
    );

    // Unlock if we locked it
    if (shouldUnlock && lockHandle) {
      await unlockFunctionGroup(connection, params.function_group_name, lockHandle);
    }

    return updateResponse;

  } catch (error: any) {
    // Unlock on error if we locked it
    if (shouldUnlock && lockHandle) {
      try {
        await unlockFunctionGroup(connection, params.function_group_name, lockHandle);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    let errorMessage = `Failed to update function group: ${error}`;
    if (error.response?.status === 400) {
      errorMessage = `Bad request. Check parameters.`;
    } else if (error.response?.status === 404) {
      errorMessage = `Function group ${params.function_group_name} not found.`;
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
        // Keep original error message
      }
    }

    throw new Error(errorMessage);
  }
}

