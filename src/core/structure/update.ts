/**
 * Structure update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateStructureParams } from './types';

/**
 * Upload structure DDL code (low-level - uses existing lockHandle)
 * This function does NOT lock/unlock - it assumes the object is already locked
 * Used internally by StructureBuilder
 */
export async function upload(
  connection: AbapConnection,
  structureName: string,
  ddlCode: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const structureNameEncoded = encodeSapObjectName(structureName);
  const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}/source/main?lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;

  const headers = {
    'Accept': 'application/xml, application/json, text/plain, */*',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: ddlCode,
    headers
  });
}

/**
 * Update structure with DDL code
 */
export async function updateStructure(
  connection: AbapConnection,
  params: UpdateStructureParams,
  lockHandle: string
): Promise<AxiosResponse> {
  if (!params.structure_name) {
    throw new Error('structure_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }

  const structureNameEncoded = encodeSapObjectName(params.structure_name);
  const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}/source/main?lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;

  const headers = {
    'Accept': 'application/xml, application/json, text/plain, */*',
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.ddl_code,
    headers
  });
}
