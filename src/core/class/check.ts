/**
 * Class check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, runCheckRunWithSource, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check class syntax via ATC/syntax checker
 *
 * Uses POST /sap/bc/adt/checkruns?reporters=abapCheckRun
 *
 * XML body format:
 * - version="inactive": Checks modified but not activated version (after create/update, before activate)
 *   <chkrun:checkObject adtcore:uri="..." chkrun:version="inactive"/>
 *
 * - version="active": Checks activated version (after activate)
 *   <chkrun:checkObject adtcore:uri="..." chkrun:version="active"/>
 *   (optionally can include source code in body, but SAP accepts without it)
 *
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'inactive' (default after create/update) or 'active' (after activate)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkClass(
  connection: AbapConnection,
  className: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'class', className, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}

/**
 * Validate class source code that hasn't been saved to SAP yet (live validation).
 *
 * This performs real-time syntax/ATC checks on unsaved source code,
 * similar to the validation Eclipse ADT editor does during typing.
 * The source code is encoded as base64 and sent as an artifact in the check request.
 *
 * Use cases:
 * - Validate code before saving to SAP
 * - Real-time validation during code editing
 * - Pre-flight checks before create/update operations
 *
 * @param connection - SAP connection
 * @param className - Class name (for context, doesn't need to exist in SAP)
 * @param sourceCode - The ABAP source code to validate
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export async function validateClassSource(
  connection: AbapConnection,
  className: string,
  sourceCode: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const response = await runCheckRunWithSource(connection, 'class', className, sourceCode, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Source validation failed: ${checkResult.message}`);
  }

  return response;
}

