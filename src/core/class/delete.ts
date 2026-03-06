/**
 * Class delete operations - Low-level functions
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
import type { IDeleteClassParams } from './types';

/**
 * Low-level: Check if class can be deleted (deletion check)
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteClassParams,
): Promise<AxiosResponse> {
  const { class_name } = params;

  if (!class_name) {
    throw new Error('class_name is required');
  }

  const encodedName = encodeSapObjectName(class_name);
  const objectUri = `/sap/bc/adt/oo/classes/${encodedName}`;

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
 * Low-level: Delete class using ADT deletion API
 */
export async function deleteClass(
  connection: IAbapConnection,
  params: IDeleteClassParams,
): Promise<AxiosResponse> {
  const { class_name, transport_request } = params;

  if (!class_name) {
    throw new Error('class_name is required');
  }

  const encodedName = encodeSapObjectName(class_name);
  const objectUri = `/sap/bc/adt/oo/classes/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Classes require empty transportNumber tag if no transport request
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
      class_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Class ${class_name} deleted successfully`,
    },
  } as AxiosResponse;
}
