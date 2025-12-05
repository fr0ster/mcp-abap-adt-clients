/**
 * Class check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';

/**
 * Check class code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active class: provide className, version='active', omit sourceCode
 * - Existing inactive class: provide className, version='inactive', omit sourceCode
 * - Hypothetical code: provide className, sourceCode, version (object doesn't need to exist)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional: source code to validate. If provided, validates hypothetical code without creating object
 * @returns Check result with errors/warnings
 */
export async function checkClass(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../../utils/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun');
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun');
  }

  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  // Check both message and errors array for these messages
  const hasCheckedMessage = checkResult.message?.toLowerCase().includes('has been checked') ||
                            checkResult.message?.toLowerCase().includes('was checked') ||
                            checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

  if (hasCheckedMessage) {
    return response; // "has been checked" is a normal response, not an error
  }

  // Only throw error if there are actual problems (ERROR or WARNING)
  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}

