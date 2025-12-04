/**
 * Program check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check program syntax
 */
export async function checkProgram(
  connection: IAbapConnection,
  programName: string,
  version: string = 'active',
  sessionId?: string,
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'program', programName, version, 'abapCheckRun', sessionId, sourceCode);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Program check failed: ${checkResult.message}`);
  }

  return response;
}

