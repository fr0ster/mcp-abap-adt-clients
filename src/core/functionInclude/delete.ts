/**
 * FunctionInclude (FUGR/I) delete operations - Low-level functions
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

export interface IDeleteFunctionIncludeParams {
  function_group_name: string;
  include_name: string;
  transport_request?: string;
}

function objectUri(groupName: string, includeName: string): string {
  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  return `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;
}

/**
 * Low-level: Check if function include can be deleted.
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteFunctionIncludeParams,
): Promise<AxiosResponse> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }
  if (!params.include_name) {
    throw new Error('include_name is required');
  }

  const uri = objectUri(params.function_group_name, params.include_name);

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/check',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION_CHECK,
      'Content-Type': CT_DELETION_CHECK,
    },
  });
}

/**
 * Low-level: Delete function include.
 */
export async function deleteFunctionInclude(
  connection: IAbapConnection,
  params: IDeleteFunctionIncludeParams,
): Promise<AxiosResponse> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }
  if (!params.include_name) {
    throw new Error('include_name is required');
  }

  const uri = objectUri(params.function_group_name, params.include_name);
  const transportTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;

  const response = await connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/delete',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION,
      'Content-Type': CT_DELETION,
    },
  });

  return {
    ...response,
    data: {
      success: true,
      function_group_name: params.function_group_name,
      include_name: params.include_name,
      object_uri: uri,
      transport_request: params.transport_request || 'local',
      message: `Function include ${params.include_name} deleted successfully`,
    },
  } as AxiosResponse;
}
