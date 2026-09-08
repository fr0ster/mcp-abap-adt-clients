/**
 * Class update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

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
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  if (!sourceCode) {
    throw new Error('source_code is required');
  }

  // Import check function
  const { checkClass } = await import('./check');
  const { parseCheckRunResponse } = await import('../../utils/checkRun');

  // Check source code before update
  const checkResponse = await checkClass(
    connection,
    className,
    'inactive',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(checkResponse);

  // Block update if there are errors
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors
      .map((err: { text?: string }) => err.text)
      .join('; ');
    throw new Error(`Class check failed, update blocked: ${errorMessages}`);
  }

  // Proceed with update (warnings are allowed)
  return await updateClass(
    connection,
    className,
    sourceCode,
    lockHandle,
    transportRequest,
    sourceContentType,
  );
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
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  if (!sourceCode) {
    throw new Error('source_code is required');
  }

  // **No lock handle is not this library's verdict.** It used to throw here, and
  // an update without a lock is a thing ADT judges: it answers its own refusal,
  // naming what it wants, and that answer is what a caller should read. The
  // parameter is simply left off the URL rather than sent empty.
  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/source/main${writeQuery(lockHandle, transportRequest)}`;

  const contentType = sourceContentType || CT_SOURCE;
  const headers = {
    'Content-Type': contentType,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
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
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  if (!implementationCode) {
    throw new Error('implementationCode is required');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${writeQuery(lockHandle, transportRequest)}`;

  const contentType = sourceContentType || CT_SOURCE;
  const headers = {
    'Content-Type': contentType,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: implementationCode,
    headers,
  });
}
