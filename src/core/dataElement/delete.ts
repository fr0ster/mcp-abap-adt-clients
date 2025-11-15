/**
 * DataElement delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteDataElementParams {
  data_element_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP data element
 */
export async function deleteDataElement(
  connection: AbapConnection,
  params: DeleteDataElementParams
): Promise<AxiosResponse> {
  if (!params.data_element_name) {
    throw new Error('data_element_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.data_element_name,
    object_type: 'DTEL/DE',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

