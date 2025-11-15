/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly.
 * To modify a function group, update its function modules instead.
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

export interface UpdateFunctionGroupParams {
  function_group_name: string;
  description?: string;
  transport_request?: string;
}

/**
 * Update function group metadata (description)
 *
 * Note: Function groups don't have source code.
 * This function can be used to update metadata like description.
 */
export async function updateFunctionGroup(
  connection: AbapConnection,
  params: UpdateFunctionGroupParams
): Promise<AxiosResponse> {
  if (!params.function_group_name) {
    throw new Error('function_group_name is required');
  }

  // Function groups are containers, they don't have source code to update
  // This is a placeholder for potential metadata updates
  throw new Error('Function groups are containers for function modules. Use updateFunctionModule to modify function modules.');
}

