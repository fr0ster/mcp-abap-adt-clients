/**
 * View delete operations - Low-level functions
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteViewParams } from './types';

/**
 * Low-level: Check if view can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteViewParams,
): Promise<AxiosResponse> {
  const { view_name } = params;

  if (!view_name) {
    throw new Error('view_name is required');
  }

  const encodedName = encodeSapObjectName(view_name);
  const objectUri = `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;

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
 * Low-level: Delete view (DDLS)
 */
export async function deleteView(
  connection: IAbapConnection,
  params: IDeleteViewParams,
): Promise<AxiosResponse> {
  const { view_name, transport_request } = params;

  if (!view_name) {
    throw new Error('view_name is required');
  }

  const encodedName = encodeSapObjectName(view_name);
  const objectUri = `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Views require empty transportNumber tag if no transport request
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
      view_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `View ${view_name} deleted successfully`,
    },
  } as AxiosResponse;
}
