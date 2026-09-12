/**
 * Structure update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateStructureParams } from './types';

/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by AdtStructure
 */
export async function upload(
  connection: IAbapConnection,
  params: IUpdateStructureParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const structureNameEncoded = encodeSapObjectName(
    params.structureName as string,
  );
  const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}/source/main${writeQuery(lockHandle, params.transportRequest)}`;

  const headers = {
    Accept: 'application/xml, application/json, text/plain, */*',
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.ddlCode,
    headers,
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
  params: IUpdateStructureParams & { lockHandle: string },
): Promise<IAdtWireResponse> {
  return upload(connection, params, params.lockHandle);
}
