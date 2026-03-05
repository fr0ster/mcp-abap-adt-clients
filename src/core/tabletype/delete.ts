/**
 * TableType delete operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteTableTypeParams } from './types';

/**
 * Low-level: Check if table type can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteTableTypeParams,
): Promise<AxiosResponse> {
  const { tabletype_name } = params;

  if (!tabletype_name) {
    throw new Error('tabletype_name is required');
  }

  const encodedName = encodeSapObjectName(tabletype_name);
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${encodedName}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION_CHECK,
    'Content-Type': CT_DELETION_CHECK,
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
 * Low-level: Delete table type
 */
export async function deleteTableType(
  connection: IAbapConnection,
  params: IDeleteTableTypeParams,
): Promise<AxiosResponse> {
  const { tabletype_name, transport_request } = params;

  if (!tabletype_name) {
    throw new Error('tabletype_name is required');
  }

  const encodedName = encodeSapObjectName(tabletype_name);
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Table types require empty transportNumber tag if no transport request
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
    Accept: ACCEPT_DELETION,
    'Content-Type': CT_DELETION,
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
      tabletype_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Table type ${tabletype_name} deleted successfully`,
    },
  } as AxiosResponse;
}
