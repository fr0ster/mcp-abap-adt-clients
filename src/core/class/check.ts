/**
 * Class check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

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

  if (!checkResult.success || checkResult.has_errors) {
    throw new Error(`Class check failed: ${checkResult.message}`);
  }

  return response;
}

