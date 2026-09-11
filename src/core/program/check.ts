/**
 * Program check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

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

  return response;
}
