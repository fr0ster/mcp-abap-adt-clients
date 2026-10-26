/**
 * Transport request delete operations
 *
 * ADT deletes a transport request only while it is empty — a request still
 * holding objects is rejected by the server, not by this client. The item
 * resource is the same one `read.ts` and `update.ts` use, distinct from the
 * collection URL.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSPORT_REQUEST } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Delete an (empty) transport request.
 *
 * `DELETE /sap/bc/adt/cts/transportrequests/<NUMBER>` — captured 2026-08-07.
 */
export async function deleteTransport(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  const url = `${TRANSPORT_REQUEST.uri(transportNumber)}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    timeout: 0,
    headers: requestHeaders(headers),
  });
}

/**
 * Ask whether a transport request can be deleted: a GET on the request itself.
 *
 * The same resource `getTransport` reads, sent with the pair the caller of
 * `checkDeletion` gave. Before 36.0.0 this request carried no header at all.
 */
export async function checkTransportDeletion(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TRANSPORT_REQUEST.uri(transportNumber)}`,
    method: 'GET',
    timeout: 0,
    headers: requestHeaders(headers),
  });
}
