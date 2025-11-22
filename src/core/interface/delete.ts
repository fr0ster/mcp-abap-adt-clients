/**
 * Interface delete operations - Low-level functions
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

export interface DeleteInterfaceParams {
  interface_name: string;
  transport_request?: string;
}

/**
 * Low-level: Check if interface can be deleted
 */
export async function checkDeletion(
  connection: AbapConnection,
  params: DeleteInterfaceParams
): Promise<AxiosResponse> {
  const { interface_name } = params;

  if (!interface_name) {
    throw new Error('interface_name is required');
  }

  const encodedName = encodeSapObjectName(interface_name);
  const objectUri = `/sap/bc/adt/oo/interfaces/${encodedName}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

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
 * Low-level: Delete interface
 */
export async function deleteInterface(
  connection: AbapConnection,
  params: DeleteInterfaceParams
): Promise<AxiosResponse> {
  const { interface_name, transport_request } = params;

  if (!interface_name) {
    throw new Error('interface_name is required');
  }

  const encodedName = encodeSapObjectName(interface_name);
  const objectUri = `/sap/bc/adt/oo/interfaces/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Interfaces require empty transportNumber tag
  let transportNumberTag = '';
  if (transport_request && transport_request.trim()) {
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
      interface_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Interface ${interface_name} deleted successfully`
    }
  } as AxiosResponse;
}
