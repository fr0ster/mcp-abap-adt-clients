/**
 * Transport create operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
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
  const owner = args.owner || username;
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
 * Create ABAP transport request
 */
export async function createTransport(
  connection: IAbapConnection,
  params: ICreateTransportParams,
): Promise<IAdtWireResponse> {
  const username = params.owner as string;

  const url = `/sap/bc/adt/cts/transportrequests`;

  const xmlBody = buildCreateTransportXml(params, username);
  const headers = {
    Accept: ACCEPT_TRANSPORT,
    'Content-Type': 'text/plain',
  };

  // The document, as it arrived. What a caller wants out of it is the
  // reading's question. A refusal comes back as the transport's failure, with
  // SAP's answer on it — it used to be rewrapped in a new Error carrying the
  // text alone, which dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
