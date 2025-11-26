/**
 * Class update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateClass(
  connection: AbapConnection,
  className: string,
  sourceCode: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  if (!sourceCode) {
    throw new Error('source_code is required');
  }

  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/source/main?lockHandle=${lockHandle}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers
  });
}

/**
 * Update class implementations include (low-level function)
 * Requires class to be locked first
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateClassImplementations(
  connection: AbapConnection,
  className: string,
  implementationCode: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  if (!implementationCode) {
    throw new Error('implementationCode is required');
  }

  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?lockHandle=${lockHandle}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Accept': 'text/plain'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: implementationCode,
    headers
  });
}


