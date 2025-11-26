/**
 * ServiceDefinition check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check service definition syntax
 */
export async function checkServiceDefinition(
  connection: AbapConnection,
  serviceDefinitionName: string,
  version: string = 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'service_definition', serviceDefinitionName, version, 'abapCheckRun', undefined, sourceCode);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Service definition check failed: ${checkResult.message}`);
  }

  return response;
}

