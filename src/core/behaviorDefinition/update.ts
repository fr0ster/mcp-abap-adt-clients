/**
 * Behavior Definition update operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateBehaviorDefinitionParams } from './types';

/**
 * Update behavior definition source code
 *
 * Endpoint: PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main?lockHandle={handle}
 *
 * Requires behavior definition to be locked first
 *
 * @param connection - ABAP connection instance
 * @param params - Update parameters
 * @returns Axios response with updated source code
 *
 * @example
 * ```typescript
 * const source = `managed implementation in class zbp_my_bdef unique;
 * strict ( 2 );
 *
 * define behavior for Z_MY_ENTITY
 * persistent table z_my_table
 * lock master
 * authorization master ( instance )
 * {
 *   create;
 *   update;
 *   delete;
 * }`;
 *
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * await update(connection, {
 *   name: 'Z_MY_BDEF',
 *   sourceCode: source,
 *   lockHandle,
 *   transportRequest: 'E19K905635'
 * });
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
export async function update(
  connection: IAbapConnection,
  params: IUpdateBehaviorDefinitionParams,
): Promise<AxiosResponse> {
  if (!params.sourceCode) {
    throw new Error('sourceCode is required');
  }

  if (!params.lockHandle) {
    throw new Error('lockHandle is required');
  }

  let url = `/sap/bc/adt/bo/behaviordefinitions/${params.name.toLowerCase()}/source/main?lockHandle=${params.lockHandle}`;
  if (params.transportRequest) {
    url += `&corrNr=${params.transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    Accept: 'text/plain',
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.sourceCode,
    headers,
  });
}
