import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteAppendStructureParams } from './types';

function objectUri(name: string): string {
  return `/sap/bc/adt/ddic/structures/${encodeSapObjectName(name.toLowerCase())}`;
}

export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteAppendStructureParams,
): Promise<IAdtWireResponse> {
  if (!params.append_structure_name)
    throw new Error('append_structure_name is required');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}"/>
</del:checkRequest>`;
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/check`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION_CHECK,
      'Content-Type': CT_DELETION_CHECK,
    },
  });
}

export async function deleteAppendStructure(
  connection: IAbapConnection,
  params: IDeleteAppendStructureParams,
): Promise<IAdtWireResponse> {
  if (!params.append_structure_name)
    throw new Error('append_structure_name is required');
  const transportNumberTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.append_structure_name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/delete`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION, 'Content-Type': CT_DELETION },
  });
  // The response, as it arrived. This used to replace the server's document
  // with `{ success: true, …, message: '… deleted successfully' }` — prose this
  // library wrote about a call it had not read, handed to a caller in place of
  // what SAP said. What a caller wants out of the answer is the reading's
  // question; the writer's job is to hand the answer over.
  return response;
}
