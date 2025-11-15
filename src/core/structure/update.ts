/**
 * Structure update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { CreateStructureParams } from './types';
import { buildCreateStructureXml } from './create';

export interface UpdateStructureParams extends CreateStructureParams {
  structure_name: string;
}

/**
 * Update structure with new data
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

  const structureNameEncoded = encodeSapObjectName(params.structure_name.toLowerCase());
  const url = `/sap/bc/adt/ddic/structures/${structureNameEncoded}?lockHandle=${lockHandle}`;

  const xmlBody = buildCreateStructureXml(params);

  const headers = {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, xmlBody, headers);
}

