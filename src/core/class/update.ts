/**
 * Class update operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Update class source code with validation (high-level function)
 * 
 * This function:
 * 1. Validates source code using check operation
 * 2. Only updates if validation passes (no errors)
 * 3. Allows warnings to pass through
 * 
 * Requires class to be locked first
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Source code to validate and update
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 * @throws Error if check finds errors or update fails
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateClassWithCheck(
  connection: IAbapConnection,
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

  // Import check function
  const { checkClass } = await import('./check');
  const { parseCheckRunResponse } = await import('../../utils/checkRun');

  // Check source code before update
  const checkResponse = await checkClass(connection, className, 'inactive', sourceCode);
  const checkResult = parseCheckRunResponse(checkResponse);

  // Block update if there are errors
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err: any) => err.text).join('; ');
    throw new Error(`Class check failed, update blocked: ${errorMessages}`);
  }

  // Proceed with update (warnings are allowed)
  return await updateClass(connection, className, sourceCode, lockHandle, transportRequest);
}

/**
 * Update class source code (low-level function)
 * Requires class to be locked first
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateClass(
  connection: IAbapConnection,
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
  connection: IAbapConnection,
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


