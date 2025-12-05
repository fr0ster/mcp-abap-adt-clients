/**
 * ServiceDefinition check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check service definition syntax
 */
export async function checkServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  version: string = 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'service_definition', serviceDefinitionName, version, 'abapCheckRun', sourceCode);
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
    throw new Error(`Service definition check failed: ${checkResult.message}`);
  }

  return response;
}

