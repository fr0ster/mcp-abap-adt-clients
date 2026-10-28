/**
 * FunctionGroup update operations
 *
 * Note: Function groups are containers for function modules.
 * They don't have source code to update directly, but metadata can be updated.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_GROUP, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateFunctionGroupParams } from './types';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to lock the group, GET its document, patch the
 * description into it, PUT the result and unlock — four requests in one member,
 * with the lock window and the merge both decided here. A caller now locks,
 * reads, edits, writes and unlocks, in the order they choose, over members that
 * each issue one request.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateFunctionGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IUpdateFunctionGroupParams,
  document: string,
): Promise<IAdtWireResponse> {
  const lockHandle = params.lock_handle as string;
  const url = `${FUNCTION_GROUP.uri(params.function_group_name as string)}${lockHandle ? `?lockHandle=${encodeURIComponent(lockHandle)}` : ''}${params.transport_request ? `${lockHandle ? '&' : '?'}corrNr=${params.transport_request}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: document,
    headers: requestHeaders(headers),
  });
}

/**
 * Upload the function group's source (low-level - uses the caller's lockHandle).
 * This function does NOT lock/unlock - it assumes the group is already locked.
 */
export async function uploadFunctionGroupSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  functionGroupName: string,
  sourceCode: string,
  lockHandle: string,
  corrNr?: string,
): Promise<IAdtWireResponse> {
  let url = `${sourceUri(FUNCTION_GROUP.uri(functionGroupName))}?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (corrNr) {
    url += `&corrNr=${corrNr}`;
  }

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: requestHeaders(headers),
  });
}
