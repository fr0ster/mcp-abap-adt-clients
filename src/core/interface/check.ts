/**
 * Interface check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check interface syntax
 */
export async function checkInterface(
  connection: AbapConnection,
  interfaceName: string,
  version: string = 'active',
  sessionId?: string,
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'interface', interfaceName, version, 'abapCheckRun', sessionId, sourceCode);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Interface check failed: ${checkResult.message}`);
  }

  return response;
}

