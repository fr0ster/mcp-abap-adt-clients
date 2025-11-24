/**
 * Class validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { runCheckRunWithSource, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 */
/**
 * Validate class name and superclass
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validateClassName(
  connection: AbapConnection,
  className: string,
  packageName?: string,
  description?: string,
  superClass?: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);

  // Build query parameters for class validation
  const params = new URLSearchParams({
    objname: encodedName,
    objtype: 'CLAS/OC'
  });

  if (packageName) {
    params.append('packagename', packageName);
  }

  if (description) {
    params.append('description', description);
  }

  if (superClass) {
    params.append('superClass', superClass);
  }

  const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers
  });
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
  const { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } = await import('../../utils/checkRun');

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
