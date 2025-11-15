/**
 * Interface delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteInterfaceParams {
  interface_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP interface
 */
export async function deleteInterface(
  connection: AbapConnection,
  params: DeleteInterfaceParams
): Promise<AxiosResponse> {
  if (!params.interface_name) {
    throw new Error('interface_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.interface_name,
    object_type: 'INTF/OI',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

