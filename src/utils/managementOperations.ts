/**
 * Core management operations - private implementations
 * All activation and check methods are implemented here once and reused by clients
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { getTimeout } from './timeouts';

/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(
  connection: IAbapConnection,
  url: string,
  method: string = 'GET',
  timeout: 'default' | 'csrf' | 'long' | number = 'default',
  data?: any,
  params?: any,
  headers?: Record<string, string>
): Promise<AxiosResponse> {
  const timeoutValue = getTimeout(timeout);
  return connection.makeAdtRequest({
    url,
    method,
    timeout: timeoutValue,
    data,
    params,
    headers,
  });
}

/**
 * Get base URL from connection
 */

/**
 * Activate multiple ABAP objects in batch
 * Uses ADT activation/runs endpoint for batch activation
 */
export async function activateObjectsGroup(
  connection: IAbapConnection,
  objects: Array<{ uri: string; name: string }>,
  preaudit: boolean = true
): Promise<AxiosResponse> {
  
  const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preaudit}`;

  const objectReferences = objects.map(obj =>
    `  <adtcore:objectReference adtcore:uri="${obj.uri}" adtcore:name="${obj.name}"/>`
  ).join('\n');

  const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

  const headers = {
    'Accept': 'application/xml',
    'Content-Type': 'application/xml'
  };

  return makeAdtRequest(connection, url, 'POST', 'default', activationXml, undefined, headers);
}

/**
 * Parse activation response to extract status and messages
 */
export function parseActivationResponse(responseData: string | any): {
  activated: boolean;
  checked: boolean;
  generated: boolean;
  messages: Array<{ type: string; text: string; line?: number; column?: number }>;
} {
  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true
  });

  try {
    const data = typeof responseData === 'string' ? responseData : responseData.data || JSON.stringify(responseData);
    const result = parser.parse(data);

    // Check for properties element
    const properties = result['chkl:messages']?.['chkl:properties'];

    const activated = properties?.['@_activationExecuted'] === 'true' || properties?.['@_activationExecuted'] === true;
    const checked = properties?.['@_checkExecuted'] === 'true' || properties?.['@_checkExecuted'] === true;
    const generated = properties?.['@_generationExecuted'] === 'true' || properties?.['@_generationExecuted'] === true;

    // Parse messages (warnings/errors)
    const messages: Array<{ type: string; text: string; line?: number; column?: number }> = [];
    const msgData = result['chkl:messages']?.['msg'];

    if (msgData) {
      const msgArray = Array.isArray(msgData) ? msgData : [msgData];
      msgArray.forEach((msg: any) => {
        messages.push({
          type: msg['@_type'] || 'info',
          text: msg['shortText']?.['txt'] || msg['shortText'] || 'Unknown message',
          line: msg['@_line'],
          column: msg['@_column']
        });
      });
    }

    return {
      activated,
      checked,
      generated,
      messages
    };
  } catch (error) {
    return {
      activated: false,
      checked: false,
      generated: false,
      messages: [{ type: 'error', text: 'Failed to parse activation response' }]
    };
  }
}

/**
 * Check ABAP object syntax
 * Uses shared checkRun utility for all object types
 */
export async function checkObject(
  connection: IAbapConnection,
  name: string,
  type: string,
  version?: string
): Promise<AxiosResponse> {
  const { runCheckRun } = await import('../utils/checkRun');
  return runCheckRun(connection, type, name, version || 'active', 'abapCheckRun');
}

