/**
 * Behavior Definition update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
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
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function update(
  connection: IAbapConnection,
  // The handle is accepted as given, including not at all. The params type in
  // the interfaces package still requires one; whether a write without a lock
  // is allowed is ADT's judgement, so this function does not add its own.
  params: Omit<IUpdateBehaviorDefinitionParams, 'lockHandle'> & {
    lockHandle?: string;
  },
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/bo/behaviordefinitions/${encodeSapObjectName(params.name as string).toLowerCase()}/source/main${writeQuery(params.lockHandle, params.transportRequest)}`;

  const headers = {
    'Content-Type': CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.sourceCode,
    headers,
  });
}
