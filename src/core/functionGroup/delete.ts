/**
 * FunctionGroup delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteFunctionGroupParams {
  function_group_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP function group
 */
export async function deleteFunctionGroup(
  connection: AbapConnection,
  params: DeleteFunctionGroupParams
): Promise<AxiosResponse> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.function_group_name,
    object_type: 'FUGR/F',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

