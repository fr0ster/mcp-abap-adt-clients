/**
 * Program delete operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteProgramParams } from './types';

/**
 * Low-level: Check if program can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteProgramParams,
): Promise<AxiosResponse> {
  const { programName: program_name } = params;

  if (!program_name) {
    throw new Error('program_name is required');
  }

  const encodedName = encodeSapObjectName(program_name);
  const objectUri = `/sap/bc/adt/programs/programs/${encodedName}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Low-level: Delete program
 */
export async function deleteProgram(
  connection: IAbapConnection,
  params: IDeleteProgramParams,
): Promise<AxiosResponse> {
  const { programName: program_name, transportRequest: transport_request } =
    params;

  if (!program_name) {
    throw new Error('program_name is required');
  }

  const encodedName = encodeSapObjectName(program_name);
  const objectUri = `/sap/bc/adt/programs/programs/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  let transportNumberTag = '';
  if (transport_request?.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
  } else {
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });

  return {
    ...response,
    data: {
      success: true,
      program_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Program ${program_name} deleted successfully`,
    },
  } as AxiosResponse;
}
