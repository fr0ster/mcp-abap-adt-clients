/**
 * View check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check view (DDLS) syntax
 */
export async function checkView(
  connection: AbapConnection,
  viewName: string,
  version: string = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'view', viewName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`View check failed: ${checkResult.message}`);
  }

  return response;
}

