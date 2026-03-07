/**
 * FunctionModule update operations - low-level functions for AdtFunctionModule
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IAdtContentTypes } from '../shared/contentTypes';
import type { IUpdateFunctionModuleParams } from './types';

/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtFunctionModule
 */
export async function update(
  connection: IAbapConnection,
  params: IUpdateFunctionModuleParams,
  contentTypes?: IAdtContentTypes,
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(
    params.functionGroupName,
  ).toLowerCase();
  const encodedModuleName = encodeSapObjectName(
    params.functionModuleName,
  ).toLowerCase();

  let url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}/source/main?lockHandle=${encodeURIComponent(params.lockHandle)}`;
  if (params.transportRequest) {
    url += `&corrNr=${params.transportRequest}`;
  }

  const sourceContentType = contentTypes?.sourceArtifactContentType();
  const headers = {
    'Content-Type': sourceContentType || CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.sourceCode,
    headers,
  });

  return response;
}
