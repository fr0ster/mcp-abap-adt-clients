/**
 * Table delete operations - Low-level functions
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

export interface DeleteTableParams {
  table_name: string;
  transport_request?: string;
}

/**
 * Low-level: Check if table can be deleted
 */
export async function checkDeletion(
  connection: AbapConnection,
  params: DeleteTableParams
): Promise<AxiosResponse> {
  const { table_name } = params;

  if (!table_name) {
    throw new Error('table_name is required');
  }

  const encodedName = encodeSapObjectName(table_name);
  const objectUri = `/sap/bc/adt/ddic/tables/${encodedName}`;

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
 * Low-level: Delete table
 */
export async function deleteTable(
  connection: AbapConnection,
  params: DeleteTableParams
): Promise<AxiosResponse> {
  const { table_name, transport_request } = params;

  if (!table_name) {
    throw new Error('table_name is required');
  }

  const encodedName = encodeSapObjectName(table_name);
  const objectUri = `/sap/bc/adt/ddic/tables/${encodedName}`;

  const baseUrl = await connection.getBaseUrl();
  const deletionUrl = `${baseUrl}/sap/bc/adt/deletion/delete`;

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
      table_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Table ${table_name} deleted successfully`
    }
  } as AxiosResponse;
}
