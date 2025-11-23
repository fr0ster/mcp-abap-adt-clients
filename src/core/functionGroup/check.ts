/**
 * FunctionGroup check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check function group code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active function group: provide functionGroupName, version='active', omit sourceCode
 * - Existing inactive function group: provide functionGroupName, version='inactive', omit sourceCode
 * - Hypothetical code: provide functionGroupName, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkFunctionGroup(
  connection: AbapConnection,
  functionGroupName: string,
  version: 'active' | 'inactive',
  sourceCode?: string,
  sessionId?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../../utils/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'function_group', functionGroupName, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(connection, 'function_group', functionGroupName, version, 'abapCheckRun', sessionId);
  }

  const checkResult = parseCheckRunResponse(response);

  // Check result is OK if:
  // 1. Message says "has been checked" or "was checked" - object was already checked, this is OK
  // Problems are: ERROR and WARNING
  // Only throw error if there are actual ERROR or WARNING messages

  // If message indicates object was already checked, it's OK (even if has errors/warnings)
  const isAlreadyChecked = checkResult.message?.toLowerCase().includes('has been checked') ||
                          checkResult.message?.toLowerCase().includes('was checked');

  if (isAlreadyChecked) {
    return response; // Object was already checked - this is OK
  }

  // Problems: ERROR (errors) and WARNING (warnings)
  if (checkResult.errors.length > 0) {
    throw new Error(`Function group check failed: ${checkResult.message || 'Unknown error'}`);
  }

  if (checkResult.warnings.length > 0) {
    throw new Error(`Function group check failed: ${checkResult.message || 'Warnings found'}`);
  }

  // If status is 'notProcessed', it's an error
  if (checkResult.status === 'notProcessed') {
    throw new Error(`Function group check failed: ${checkResult.message || 'Object could not be processed'}`);
  }

  return response;
}

