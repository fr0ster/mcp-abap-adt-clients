/**
 * Program check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check program syntax
 */
export async function checkProgram(
  connection: IAbapConnection,
  programName: string,
  version: string = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<AxiosResponse> {
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
