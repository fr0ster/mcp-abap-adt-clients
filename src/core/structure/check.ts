/**
 * Structure check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check structure syntax
 */
export async function checkStructure(
  connection: AbapConnection,
  structureName: string,
  version: string = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'structure', structureName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Structure check failed: ${checkResult.message}`);
  }

  return response;
}

