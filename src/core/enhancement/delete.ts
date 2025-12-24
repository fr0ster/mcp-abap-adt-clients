/**
 * Enhancement delete operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { getEnhancementUri, type IDeleteEnhancementParams } from './types';

/**
 * Low-level: Check if enhancement can be deleted (deletion check)
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion check result
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteEnhancementParams,
): Promise<AxiosResponse> {
  const { enhancement_name, enhancement_type } = params;

  if (!enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!enhancement_type) {
    throw new Error('enhancement_type is required');
  }

  const encodedName = encodeSapObjectName(enhancement_name);
  const objectUri = getEnhancementUri(enhancement_type, encodedName);

  const checkUrl = `/sap/bc/adt/deletion/check`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Low-level: Delete enhancement using ADT deletion API
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion result
 */
export async function deleteEnhancement(
  connection: IAbapConnection,
  params: IDeleteEnhancementParams,
): Promise<AxiosResponse> {
  const { enhancement_name, enhancement_type, transport_request } = params;

  if (!enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!enhancement_type) {
    throw new Error('enhancement_type is required');
  }

  const encodedName = encodeSapObjectName(enhancement_name);
  const objectUri = getEnhancementUri(enhancement_type, encodedName);

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Build transport number tag
  let transportNumberTag = '';
  if (transport_request?.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
  } else {
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });

  return {
    ...response,
    data: {
      success: true,
      enhancement_name,
      enhancement_type,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Enhancement ${enhancement_name} deleted successfully`,
    },
  } as AxiosResponse;
}
