/**
 * Domain delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteDomainParams {
  domain_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP domain
 */
export async function deleteDomain(
  connection: AbapConnection,
  params: DeleteDomainParams
): Promise<AxiosResponse> {
  if (!params.domain_name) {
    throw new Error('domain_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.domain_name,
    object_type: 'DOMA/DD',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

