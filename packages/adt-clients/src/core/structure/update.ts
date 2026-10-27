/**
 * Structure update operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE, sourceUri } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateStructureParams } from './types';

/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtStructure
 */
export async function upload(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IUpdateStructureParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(STRUCTURE.uri(params.structureName as string))}${writeQuery(lockHandle, params.transportRequest)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: params.ddlCode,
    headers: requestHeaders(headers),
  });
}

/**
 * Update structure with DDL code (alias for upload with lockHandle in params)
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateStructure(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IUpdateStructureParams & { lockHandle: string },
): Promise<IAdtWireResponse> {
  return upload(connection, headers, params, params.lockHandle);
}
