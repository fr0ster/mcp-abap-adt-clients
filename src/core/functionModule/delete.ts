/**
 * FunctionModule delete operations - Low-level functions
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
import type { IDeleteFunctionModuleParams } from './types';

/**
 * Low-level: Check if function module can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteFunctionModuleParams,
): Promise<AxiosResponse> {
  const { function_module_name, function_group_name } = params;

  if (!function_module_name) {
    throw new Error('function_module_name is required');
  }
  if (!function_group_name) {
    throw new Error('function_group_name is required');
  }

  const encodedGroupName = encodeSapObjectName(function_group_name);
  const encodedModuleName = encodeSapObjectName(function_module_name);
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;

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
 * Low-level: Delete function module
 */
export async function deleteFunctionModule(
  connection: IAbapConnection,
  params: IDeleteFunctionModuleParams,
): Promise<AxiosResponse> {
  const { function_module_name, function_group_name, transport_request } =
    params;

  if (!function_module_name) {
    throw new Error('function_module_name is required');
  }
  if (!function_group_name) {
    throw new Error('function_group_name is required');
  }

  const encodedGroupName = encodeSapObjectName(function_group_name);
  const encodedModuleName = encodeSapObjectName(function_module_name);
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Function Modules require empty transportNumber tag if no transport request
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
      function_module_name,
      function_group_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Function module ${function_module_name} deleted successfully`,
    },
  } as AxiosResponse;
}
