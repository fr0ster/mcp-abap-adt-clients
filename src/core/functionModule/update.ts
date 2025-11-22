/**
 * FunctionModule update operations - low-level functions for FunctionModuleBuilder
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by FunctionModuleBuilder
 */
export async function update(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  lockHandle: string,
  sourceCode: string,
  corrNr?: string
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();

  let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}/source/main?lockHandle=${lockHandle}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers
  });

  return {
    data: {
      success: true,
      function_module_name: functionModuleName.toUpperCase(),
      function_group_name: functionGroupName,
      type: 'FUGR/FF',
      message: `Function module ${functionModuleName.toUpperCase()} source updated successfully`,
      uri: `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`,
      source_size_bytes: sourceCode.length
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
  } as AxiosResponse;
}

