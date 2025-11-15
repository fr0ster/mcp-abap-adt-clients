/**
 * View delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteViewParams {
  view_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP view (DDLS)
 */
export async function deleteView(
  connection: AbapConnection,
  params: DeleteViewParams
): Promise<AxiosResponse> {
  if (!params.view_name) {
    throw new Error('view_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.view_name,
    object_type: 'DDLS/DF',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

