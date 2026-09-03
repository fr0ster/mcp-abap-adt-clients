/**
 * Interface check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  type CheckRunVersion,
  parseCheckRunResponse,
  runCheckRun,
} from '../../utils/checkRun';

/**
 * Check interface syntax
 */
export async function checkInterface(
  connection: IAbapConnection,
  interfaceName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'interface',
    interfaceName,
    version,
    'abapCheckRun',
    sourceCode,
    artifactContentType,
  );
  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Interface check failed: ${errorMessages}`);
  }

  return response;
}
