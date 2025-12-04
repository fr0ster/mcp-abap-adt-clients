/**
 * Package delete operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

export interface DeletePackageParams {
  package_name: string;
  transport_request?: string;
}

/**
 * Check if package can be deleted (deletion check)
 * Returns response with isDeletable flag
 * 
 * NOTE: Uses stateful session headers automatically if connection has stateful mode enabled
 */
export async function checkPackageDeletion(
  connection: IAbapConnection,
  params: DeletePackageParams
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const encodedName = encodeSapObjectName(params.package_name);
  const objectUri = `/sap/bc/adt/packages/${encodedName}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

  // Build XML check request (no transportNumber in check request)
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml'
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });
}

/**
 * Parse deletion check response to get isDeletable flag
 */
export function parsePackageDeletionCheck(response: AxiosResponse): { isDeletable: boolean; message?: string } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  try {
    const result = parser.parse(response.data);
    const checkObject = result['del:checkResponse']?.['del:object'] || result['checkResponse']?.['object'];
    
    if (!checkObject) {
      return { isDeletable: false, message: 'No check result in response' };
    }

    const isDeletable = checkObject['@_del:isDeletable'] === 'true' || checkObject['@_isDeletable'] === 'true';
    const message = checkObject['del:message']?.['del:text'] || checkObject['message']?.['text'] || '';

    return { isDeletable, message: message || undefined };
  } catch (error) {
    return { isDeletable: false, message: `Failed to parse check response: ${error}` };
  }
}

/**
 * Delete ABAP package using ADT deletion API
 * For packages, empty transportNumber tag may be required
 */
export async function deletePackage(
  connection: IAbapConnection,
  params: DeletePackageParams
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const encodedName = encodeSapObjectName(params.package_name);
  const objectUri = `/sap/bc/adt/packages/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Build XML deletion request
  // For packages, empty transportNumber tag may be required if no transport_request provided
  let transportNumberTag = '';
  if (params.transport_request && params.transport_request.trim()) {
    transportNumberTag = `<del:transportNumber>${params.transport_request}</del:transportNumber>`;
  } else {
    // For packages: add empty self-closing tag
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.deletion.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml'
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers
  });

  // Parse response to check if deletion was successful
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  try {
    const result = parser.parse(response.data);
    const deleteObject = result['del:deletionResult']?.['del:object'] || result['deletionResult']?.['object'];
    const isDeleted = deleteObject?.['@_del:isDeleted'] === 'true' || deleteObject?.['@_isDeleted'] === 'true';

    if (!isDeleted) {
      const message = deleteObject?.['del:message']?.['del:text'] || deleteObject?.['message']?.['text'] || 'Deletion failed';
      throw new Error(`Package deletion failed: ${message}`);
    }
  } catch (error: any) {
    // If parsing fails or isDeleted is false, throw error
    if (error.message && error.message.includes('Package deletion failed')) {
      throw error;
    }
    // If it's a parse error, check HTTP status
    if (response.status >= 400) {
      throw new Error(`Package deletion failed: HTTP ${response.status} ${response.statusText}`);
    }
  }

  // Return success response
  return {
    ...response,
    data: {
      success: true,
      package_name: params.package_name,
      object_type: 'DEVC/K',
      object_uri: objectUri,
      transport_request: params.transport_request || 'local',
      message: `Package ${params.package_name} deleted successfully`
    }
  } as AxiosResponse;
}

