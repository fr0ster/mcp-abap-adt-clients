/**
 * FunctionInclude (FUGR/I) delete operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

export interface IDeleteFunctionIncludeParams {
  function_group_name: string;
  include_name: string;
  transport_request?: string;
}

function objectUri(groupName: string, includeName: string): string {
  return `${FUNCTION_INCLUDE.uri(groupName, includeName)}`;
}

/**
 * Low-level: Check if function include can be deleted.
 */
export async function checkDeletion(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteFunctionIncludeParams,
): Promise<IAdtWireResponse> {
  const uri = objectUri(params.function_group_name, params.include_name);

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/check',
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}

/**
 * Low-level: Delete function include.
 */
export async function deleteFunctionInclude(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteFunctionIncludeParams,
): Promise<IAdtWireResponse> {
  const uri = objectUri(params.function_group_name, params.include_name);
  const transportTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;

  // The response, as it arrived. The deletion service answers HTTP 200 even
  // when it refuses to delete (`del:isDeleted="false"` with a `del:message`),
  // and until 23.0.0 this parsed that and threw — a verdict about SAP's answer
  // raised as a library failure, with the answer dropped. Whether the document
  // says "not deleted" is the caller's `analyse` to read (`analyseDeletion` in
  // @mcp-abap-adt/adt-strategies).
  // Before that it replaced the server's document with prose of its own.
  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/delete',
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}
