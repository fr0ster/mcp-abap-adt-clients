/**
 * Core management operations - private implementations
 * All activation and check methods are implemented here once and reused by clients
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { getTimeout } from '@mcp-abap-adt/connection';

/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(
  connection: AbapConnection,
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
async function getBaseUrl(connection: AbapConnection): Promise<string> {
  return connection.getBaseUrl();
}

/**
 * Activate ABAP objects
 * TODO: Implement full activation logic from handleActivateObject
 */
export async function activateObject(
  connection: AbapConnection,
  objects: Array<{name: string, type: string}>
): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const url = `${baseUrl}/sap/bc/adt/activation/runs?method=activate&preauditRequested=true`;

  // TODO: Build activation XML from objects array
  const activationXml = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objects.map(obj => `  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/${obj.name.toLowerCase()}" adtcore:name="${obj.name}"/>`).join('\n')}
</adtcore:objectReferences>`;

  const headers = {
    'Accept': 'application/xml',
    'Content-Type': 'application/xml'
  };

  return makeAdtRequest(connection, url, 'POST', 'default', activationXml, undefined, headers);
}

/**
 * Check ABAP object syntax
 * Uses shared checkRun utility for all object types
 */
export async function checkObject(
  connection: AbapConnection,
  name: string,
  type: string,
  version?: string
): Promise<AxiosResponse> {
  const { runCheckRun } = await import('./shared/checkRun');
  return runCheckRun(connection, type, name, version || 'active', 'abapCheckRun');
}

