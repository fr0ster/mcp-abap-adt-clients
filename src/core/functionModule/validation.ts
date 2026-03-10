/**
 * Function Module validation
 * Uses ADT validation endpoint: /sap/bc/adt/functions/validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate function module name
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * Endpoint: POST /sap/bc/adt/functions/validation
 *
 * Query parameters:
 * - objtype: FUGR/FF
 * - objname: function module name
 * - fugrname: function group name
 * - description: optional description
 *
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> message (e.g., "Function module ... already exists")
 */
export async function validateFunctionModuleName(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'FUGR/FF',
    objname: functionModuleName,
    fugrname: functionGroupName,
  });

  if (description) {
    queryParams.append('description', description);
  }

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage',
    },
  });
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
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  sourceCode?: string,
  version: 'inactive' | 'active' = 'active',
): Promise<AxiosResponse> {
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } =
    await import('../../utils/checkRun');

  // Build object type path for function module
  const objectType = 'function_module';
  const objectName = `${functionGroupName}/${functionModuleName}`;

  let response: AxiosResponse;

  if (sourceCode) {
    // Live validation with artifacts (code not saved to SAP)
    response = await runCheckRunWithSource(
      connection,
      objectType,
      objectName,
      sourceCode,
      version,
      'abapCheckRun',
    );
  } else {
    // Validate existing object in SAP (without artifacts)
    response = await runCheckRun(
      connection,
      objectType,
      objectName,
      version,
      'abapCheckRun',
    );
  }

  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Source validation failed: ${errorMessages}`);
  }

  if (checkResult.warnings.length > 0) {
    throw new Error(
      `Source validation failed: ${checkResult.message || 'Warnings found'}`,
    );
  }

  // If status is 'notProcessed', it's an error
  if (checkResult.status === 'notProcessed') {
    throw new Error(
      `Source validation failed: ${checkResult.message || 'Object could not be processed'}`,
    );
  }

  return response;
}
