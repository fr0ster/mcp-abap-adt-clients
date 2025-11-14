/**
 * Function Module validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { validateObjectName, ValidationResult } from '../shared/validation';

/**
 * Validate function module name
 */
export async function validateFunctionModuleName(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {
    fugrname: encodeSapObjectName(functionGroupName)
  };

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'FUGR/FF', functionModuleName, params);
}

/**
 * Validate function module source code.
 *
 * If sourceCode is provided: validates unsaved code (live validation with artifacts)
 * If sourceCode is not provided: validates existing FM code in SAP system (without artifacts)
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param sourceCode - Optional: source code to validate. If omitted, validates existing FM in SAP
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export async function validateFunctionModuleSource(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  sourceCode?: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../shared/checkRun');

  // Build object type path for function module
  const objectType = 'function_module';
  const objectName = `${functionGroupName}/${functionModuleName}`;

  let response: AxiosResponse;
  
  if (sourceCode) {
    // Live validation with artifacts (code not saved to SAP)
    response = await runCheckRunWithSource(connection, objectType, objectName, sourceCode, version, 'abapCheckRun', sessionId);
  } else {
    // Validate existing object in SAP (without artifacts)
    response = await runCheckRun(connection, objectType, objectName, version, 'abapCheckRun', sessionId);
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Source validation failed: ${checkResult.message}`);
  }

  return response;
}
