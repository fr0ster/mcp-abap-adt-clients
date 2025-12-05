/**
 * FunctionModule update operations - low-level functions for FunctionModuleBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateFunctionModuleParams } from './types';

/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by FunctionModuleBuilder
 */
export async function update(
  connection: IAbapConnection,
  params: UpdateFunctionModuleParams
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(params.functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(params.functionModuleName).toLowerCase();

  let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}/source/main?lockHandle=${params.lockHandle}`;
  if (params.transportRequest) {
    url += `&corrNr=${params.transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.sourceCode,
    headers
  });

  return {
    data: {
      success: true,
      function_module_name: params.functionModuleName.toUpperCase(),
      function_group_name: params.functionGroupName,
      type: 'FUGR/FF',
      message: `Function module ${params.functionModuleName.toUpperCase()} source updated successfully`,
      uri: `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`,
      source_size_bytes: params.sourceCode.length
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
  } as AxiosResponse;
}

