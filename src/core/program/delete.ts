/**
 * Program delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, DeleteObjectParams } from '../delete';

export interface DeleteProgramParams {
  program_name: string;
  transport_request?: string;
}

/**
 * Delete ABAP program
 */
export async function deleteProgram(
  connection: AbapConnection,
  params: DeleteProgramParams
): Promise<AxiosResponse> {
  if (!params.program_name) {
    throw new Error('program_name is required');
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.program_name,
    object_type: 'PROG/P',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

