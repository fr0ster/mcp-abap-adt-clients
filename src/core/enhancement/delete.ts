/**
 * Enhancement delete operations - Low-level functions
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import { getEnhancementUri, type IDeleteEnhancementParams } from './types';

/**
 * Low-level: Check if enhancement can be deleted (deletion check)
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion check result
 */
export async function checkDeletion(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteEnhancementParams,
): Promise<IAdtWireResponse> {
  const { enhancement_name, enhancement_type } = params;

  const objectUri = getEnhancementUri(enhancement_type, enhancement_name);

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
 * Low-level: Delete enhancement using ADT deletion API
 *
 * @param connection - SAP connection
 * @param params - Delete parameters
 * @returns Axios response with deletion result
 */
export async function deleteEnhancement(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IDeleteEnhancementParams,
): Promise<IAdtWireResponse> {
  const { enhancement_name, enhancement_type, transport_request } = params;

  const objectUri = getEnhancementUri(enhancement_type, enhancement_name);

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Build transport number tag
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
