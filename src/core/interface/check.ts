/**
 * Interface check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check interface syntax
 */
export async function checkInterface(
  connection: IAbapConnection,
  interfaceName: string,
  version: string = 'active',
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'interface', interfaceName, version, 'abapCheckRun', sourceCode);
  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  // Check both message and errors array for these messages
  const hasCheckedMessage = checkResult.message?.toLowerCase().includes('has been checked') ||
                            checkResult.message?.toLowerCase().includes('was checked') ||
                            checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

  if (hasCheckedMessage) {
    return response; // "has been checked" is a normal response, not an error
  }

  // Only throw error if there are actual problems (ERROR or WARNING)
  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Interface check failed: ${checkResult.message}`);
  }

  return response;
}

