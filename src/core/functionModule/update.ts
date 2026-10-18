/**
 * FunctionModule update operations - low-level functions for AdtFunctionModule
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_MODULE, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateFunctionModuleParams } from './types';

/**
 * Upload function module source code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtFunctionModule
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function update(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IUpdateFunctionModuleParams,
): Promise<IAdtWireResponse> {
  let url = `${sourceUri(FUNCTION_MODULE.uri(params.functionGroupName, params.functionModuleName))}?lockHandle=${encodeURIComponent(params.lockHandle)}`;
  if (params.transportRequest) {
    url += `&corrNr=${params.transportRequest}`;
  }

  const response = await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: params.sourceCode,
    headers: requestHeaders(headers),
  });

  return response;
}
