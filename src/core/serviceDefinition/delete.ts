/**
 * ServiceDefinition delete operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SERVICE_DEFINITION } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IDeleteServiceDefinitionParams } from './types';

/**
 * Low-level: Check if service definition can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteServiceDefinitionParams,
): Promise<IAdtWireResponse> {
  const { service_definition_name } = params;

  const objectUri = `${SERVICE_DEFINITION.uri(service_definition_name)}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}

/**
 * Low-level: Delete service definition
 */
export async function deleteServiceDefinition(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteServiceDefinitionParams,
): Promise<IAdtWireResponse> {
  const { service_definition_name, transport_request } = params;

  const objectUri = `${SERVICE_DEFINITION.uri(service_definition_name)}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Service Definitions require empty transportNumber tag if no transport request
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

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });

  // The response, as it arrived. This used to replace the server's document
  // with `{ success: true, …, message: '… deleted successfully' }` — prose this
  // library wrote about a call it had not read, handed to a caller in place of
  // what SAP said. What a caller wants out of the answer is the reading's
  // question; the writer's job is to hand the answer over.
  return response;
}
