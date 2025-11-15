/**
 * FunctionModule delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteFunctionModuleParams {
  function_module_name: string;
  function_group_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP function module
 */
export async function deleteFunctionModule(
  connection: AbapConnection,
  params: DeleteFunctionModuleParams
): Promise<AxiosResponse> {
  if (!params.function_module_name) {
    throw new Error('function_module_name is required');
  }
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.function_module_name,
    object_type: 'FUGR/FF',
    function_group_name: params.function_group_name,
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

