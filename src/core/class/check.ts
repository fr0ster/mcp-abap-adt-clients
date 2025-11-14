/**
 * Class check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

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
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive',
  sourceCode?: string,
  sessionId?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}

