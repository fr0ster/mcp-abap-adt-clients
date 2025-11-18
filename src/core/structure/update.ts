/**
 * Structure update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { UpdateStructureParams } from './types';

/**
 * Update structure with DDL code
 */
export async function updateStructure(
  connection: AbapConnection,
  params: UpdateStructureParams,
  lockHandle: string,
  sessionId: string
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

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, params.ddl_code, headers);
}

