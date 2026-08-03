/**
 * ServiceDefinition check operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check service definition syntax
 */
export async function checkServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<IAdtResponse> {
  const response = await runCheckRun(
    connection,
    'service_definition',
    serviceDefinitionName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Service definition check failed: ${errorMessages}`);
  }

  return response;
}
