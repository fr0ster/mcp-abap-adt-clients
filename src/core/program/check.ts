/**
 * Program check operations
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
 * Check program syntax
 */
export async function checkProgram(
  connection: IAbapConnection,
  programName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'program',
    programName,
    version,
    'abapCheckRun',
    sourceCode,
    artifactContentType,
  );
  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Program check failed: ${errorMessages}`);
  }

  return response;
}
