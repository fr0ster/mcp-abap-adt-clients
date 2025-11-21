/**
 * DataElement delete operations - Low-level functions
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

export interface DeleteDataElementParams {
  data_element_name: string;
  transport_request?: string;
}

/**
 * Low-level: Check if data element can be deleted
 */
export async function checkDeletion(
  connection: AbapConnection,
  params: DeleteDataElementParams
): Promise<AxiosResponse> {
  const { data_element_name } = params;

  if (!data_element_name) {
    throw new Error('data_element_name is required');
  }

  const encodedName = encodeSapObjectName(data_element_name);
  const objectUri = `/sap/bc/adt/ddic/dataelements/${encodedName}`;

  const baseUrl = await connection.getBaseUrl();
  const checkUrl = `${baseUrl}/sap/bc/adt/deletion/check`;

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
 * Low-level: Delete data element
 */
export async function deleteDataElement(
  connection: AbapConnection,
  params: DeleteDataElementParams
): Promise<AxiosResponse> {
  const { data_element_name, transport_request } = params;

  if (!data_element_name) {
    throw new Error('data_element_name is required');
  }

  const encodedName = encodeSapObjectName(data_element_name);
  const objectUri = `/sap/bc/adt/ddic/dataelements/${encodedName}`;

  const baseUrl = await connection.getBaseUrl();
  const deletionUrl = `${baseUrl}/sap/bc/adt/deletion/delete`;

  // Data elements don't require empty tag
  let transportNumberTag = '';
  if (transport_request && transport_request.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
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

  return {
    ...response,
    data: {
      success: true,
      data_element_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Data element ${data_element_name} deleted successfully`
    }
  } as AxiosResponse;
}
