/**
 * Transport create operations
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { safeStringify } from '../../utils/internalUtils';
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
  if (!params.description) {
    throw new Error('Transport description is required');
  }

  const username = params.owner;

  if (!username) {
    throw new Error(
      'Cannot create transport request: owner is required. Please provide owner in params.',
    );
  }

  const url = `/sap/bc/adt/cts/transportrequests`;

  const xmlBody = buildCreateTransportXml(params, username);
  const headers = {
    Accept: ACCEPT_TRANSPORT,
    'Content-Type': 'text/plain',
  };

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers,
    });

    // The document, as it arrived. What a caller wants out of it is the
    // reading's question — `parseCreatedTransport` is the shipped answer.
    return response;
  } catch (error: unknown) {
    const e = error as HttpError;
    const errorMessage = e.response?.data
      ? typeof e.response.data === 'string'
        ? e.response.data
        : safeStringify(e.response.data)
      : e.message;

    throw new Error(`Failed to create transport request: ${errorMessage}`);
  }
}
