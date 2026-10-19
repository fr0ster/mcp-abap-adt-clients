/**
 * Transport create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSPORT_REQUEST } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateTransportParams } from './types';

/**
 * Create transport request XML payload
 */
function buildCreateTransportXml(
  args: ICreateTransportParams,
  username: string,
): string {
  const transportType = args.transport_type === 'customizing' ? 'T' : 'K';
  const description = args.description || 'Transport request created via MCP';
  // SAP user names are upper case, and CTS compares them as given: a lower
  // case owner was refused, measured on premise, with SCTS_ADT_MSG 009 "User …
  // does not exist in the system (or locked)".
  const owner = (args.owner || username || '').toUpperCase();
  const target = args.target_system?.trim()
    ? `/${args.target_system}/`
    : 'LOCAL';

  return `<?xml version="1.0" encoding="ASCII"?>
<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:useraction="newrequest">
  <tm:request tm:desc="${description}" tm:type="${transportType}" tm:target="${target}" tm:cts_project="">
    <tm:task tm:owner="${owner}"/>
  </tm:request>
</tm:root>`;
}

/**
 * Create ABAP transport request.
 *
 * One POST creates the request and its first task together: the document
 * carries the `tm:request` and, inside it, the `tm:task` with its owner. The
 * library makes no second call, so it has no point at which to notice a half
 * done create — see `AdtRequest.create`.
 */
export async function createTransport(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateTransportParams,
): Promise<IAdtWireResponse> {
  const username = params.owner as string;

  const url = TRANSPORT_REQUEST.collection;

  const xmlBody = buildCreateTransportXml(params, username);

  // The document, as it arrived. What a caller wants out of it is the
  // reading's question. A refusal comes back as the transport's failure, with
  // SAP's answer on it — it used to be rewrapped in a new Error carrying the
  // text alone, which dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
