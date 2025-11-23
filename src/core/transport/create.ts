/**
 * Transport create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { CreateTransportParams } from './types';

/**
 * Create transport request XML payload
 */
function buildCreateTransportXml(args: CreateTransportParams, username: string): string {
  const transportType = args.transport_type === 'customizing' ? 'T' : 'K';
  const description = args.description || 'Transport request created via MCP';
  const owner = args.owner || username;
  const target = args.target_system && args.target_system.trim()
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
 * Parse transport creation response
 */
function parseTransportResponse(xmlData: string): any {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
  });

  const result = parser.parse(xmlData);
  const root = result['tm:root'] || result['root'];

  if (!root) {
    throw new Error('Invalid transport response XML structure - no tm:root found');
  }

  const request = root['tm:request'] || {};
  const task = request['tm:task'] || {};

  return {
    transport_number: request['tm:number'],
    description: request['tm:desc'] || request['tm:description'],
    type: request['tm:type'],
    target_system: request['tm:target'],
    target_desc: request['tm:target_desc'],
    cts_project: request['tm:cts_project'],
    cts_project_desc: request['tm:cts_project_desc'],
    uri: request['tm:uri'],
    parent: request['tm:parent'],
    owner: task['tm:owner'] || request['tm:owner']
  };
}

/**
 * Create ABAP transport request
 */
export async function createTransport(
  connection: AbapConnection,
  params: CreateTransportParams
): Promise<AxiosResponse> {
  if (!params.description) {
    throw new Error('Transport description is required');
  }

  // Get username from connection config or system information
  const config = connection.getConfig();
  let username = params.owner || config.username || process.env.SAP_USERNAME || process.env.SAP_USER;

  // If username not found in config, try to get from system information
  if (!username) {
    try {
      const { getSystemInformation } = await import('../../utils/systemInfo');
      const systemInfo = await getSystemInformation(connection);
      if (systemInfo?.userName) {
        username = systemInfo.userName;
      }
    } catch (error) {
      // Ignore errors - fallback to default
    }
  }

  // If username still not found, throw error (cannot create transport without valid user)
  if (!username) {
    throw new Error('Cannot create transport request: username not found. Please provide owner in params, set SAP_USERNAME in config, or ensure system information endpoint is available.');
  }

  const url = `/sap/bc/adt/cts/transportrequests`;

  const xmlBody = buildCreateTransportXml(params, username);
  const headers = {
    'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml',
    'Content-Type': 'text/plain'
  };

  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers
    });

    const transportInfo = parseTransportResponse(response.data);
    const requestOwner = params.owner || username;

    return {
      data: {
        success: true,
        transport_request: transportInfo.transport_number,
        description: transportInfo.description,
        type: transportInfo.type,
        target_system: transportInfo.target_system,
        target_desc: transportInfo.target_desc,
        cts_project: transportInfo.cts_project,
        owner: requestOwner,
        uri: transportInfo.uri,
        message: `Transport request ${transportInfo.transport_number} created successfully`
      },
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config
    } as AxiosResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create transport request: ${errorMessage}`);
  }
}

