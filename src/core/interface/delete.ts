/**
 * Interface delete operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { deleteObject, checkDeletion, DeleteObjectParams } from '../delete';

export interface DeleteInterfaceParams {
  interface_name: string;
  transport_request?: string;
  check_before_delete?: boolean; // Optional: check deletion before deleting (default: true)
}

/**
 * Check if interface can be deleted
 */
export async function checkInterfaceDeletion(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  if (!interfaceName) {
    throw new Error('interface_name is required');
  }

  const checkParams: DeleteObjectParams = {
    object_name: interfaceName,
    object_type: 'INTF/OI'
  };

  return await checkDeletion(connection, checkParams);
}

/**
 * Delete ABAP interface
 * Optionally checks deletion before deleting (like Eclipse ADT)
 */
export async function deleteInterface(
  connection: AbapConnection,
  params: DeleteInterfaceParams
): Promise<AxiosResponse> {
  if (!params.interface_name) {
    throw new Error('interface_name is required');
  }

  // Optional: Check deletion before deleting (like Eclipse ADT)
  // This can be useful to verify object is deletable and get dependencies
  if (params.check_before_delete !== false) {
    try {
      await checkInterfaceDeletion(connection, params.interface_name);
    } catch (error) {
      // If check fails, still attempt deletion (check is optional)
      // Log warning but continue
    }
  }

  const deleteParams: DeleteObjectParams = {
    object_name: params.interface_name,
    object_type: 'INTF/OI',
    transport_request: params.transport_request
  };

  return await deleteObject(connection, deleteParams);
}

