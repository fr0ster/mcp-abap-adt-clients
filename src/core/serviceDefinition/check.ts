/**
 * ServiceDefinition check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check service definition syntax
 */
export async function checkServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'service_definition',
    serviceDefinitionName,
    version,
    'abapCheckRun',
    sourceCode,
  );

  return response;
}
