/**
 * Structure update operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateStructureParams } from './types';

/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by StructureBuilder
 */
export async function upload(
  connection: IAbapConnection,
  params: UpdateStructureParams,
  lockHandle: string
): Promise<AxiosResponse> {
  const structureNameEncoded = encodeSapObjectName(params.structureName);
  const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}/source/main?lockHandle=${lockHandle}${params.transportRequest ? `&corrNr=${params.transportRequest}` : ''}`;

  const headers = {
    'Accept': 'application/xml, application/json, text/plain, */*',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.ddlCode,
    headers
  });
}

/**
 * Update structure with DDL code (alias for upload with lockHandle in params)
 */
export async function updateStructure(
  connection: IAbapConnection,
  params: UpdateStructureParams & { lockHandle: string }
): Promise<AxiosResponse> {
  return upload(connection, params, params.lockHandle);
}
