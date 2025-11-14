/**
 * Class validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { validateObjectName, ValidationResult } from '../shared/validation';
import { runCheckRunWithSource, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Validate class name
 */
export async function validateClassName(
  connection: AbapConnection,
  className: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'CLAS/OC', className, params);
}

/**
 * Validate class source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing class code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing class in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export async function validateClassSource(
  connection: AbapConnection,
  className: string,
  sourceCode?: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');

  let response: AxiosResponse;

  if (sourceCode) {
    // Live validation with artifacts (code not saved to SAP)
    response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (without artifacts)
    response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Source validation failed: ${checkResult.message}`);
  }

  return response;
}
