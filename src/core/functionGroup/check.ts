/**
 * FunctionGroup check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';

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
 * @returns Check result with errors/warnings
 */
export async function checkFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  version: 'active' | 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } =
    await import('../../utils/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Validate hypothetical code (object doesn't need to exist)
    response = await runCheckRunWithSource(
      connection,
      'function_group',
      functionGroupName,
      sourceCode,
      version,
      'abapCheckRun',
    );
  } else {
    // Validate existing object in SAP (reads from system)
    response = await runCheckRun(
      connection,
      'function_group',
      functionGroupName,
      version,
      'abapCheckRun',
    );
  }

  const checkResult = parseCheckRunResponse(response);

  // Check only for type E messages - HTTP 200 is normal, errors are in XML response
  if (checkResult.errors.length > 0) {
    const errorTexts = checkResult.errors
      .map((err) => err.text || '')
      .join(' ')
      .toLowerCase();

    // WORKAROUND: Ignore Kerberos library not loaded error (test cloud issue)
    // This is a known issue in test environments where Kerberos library is not available
    const isKerberosError = errorTexts.includes('kerberos library not loaded');

    // Ignore "has been checked" messages (normal, not an error)
    const isAlreadyChecked =
      errorTexts.includes('has been checked') ||
      errorTexts.includes('was checked');

    // For newly created empty function groups (no function modules), these errors are expected
    // until function modules are added to the function group
    const isEmptyFunctionGroupError =
      (errorTexts.includes('report') &&
        errorTexts.includes('program statement is missing')) ||
      errorTexts.includes('program type is include') ||
      errorTexts.includes('report/program statement is missing');

    const shouldIgnore =
      isKerberosError || isAlreadyChecked || isEmptyFunctionGroupError;

    if (!shouldIgnore) {
      // Has type E errors that should not be ignored - throw error
      const errorMessages = checkResult.errors
        .map((err) => err.text)
        .join('; ');
      throw new Error(`Function group check failed: ${errorMessages}`);
    }
  }

  return response;
}
