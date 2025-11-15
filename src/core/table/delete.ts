/**
 * Table delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteTableParams {
  table_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP table
 */
export async function deleteTable(
  connection: AbapConnection,
  params: DeleteTableParams
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('table_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.table_name,
    object_type: 'TABL/DT',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

