/**
 * Structure delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteStructureParams {
  structure_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP structure
 */
export async function deleteStructure(
  connection: AbapConnection,
  params: DeleteStructureParams
): Promise<AxiosResponse> {
  if (!params.structure_name) {
    throw new Error('structure_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.structure_name,
    object_type: 'STRU/DT',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

