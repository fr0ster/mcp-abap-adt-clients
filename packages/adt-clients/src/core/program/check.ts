/**
 * Program check operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check program syntax
 */
export async function checkProgram(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  programName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    headers,
    'program',
    programName,
    version,
    'abapCheckRun',
    sourceCode,
    artifactContentType,
  );

  return response;
}
