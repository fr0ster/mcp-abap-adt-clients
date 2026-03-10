/**
 * Interface check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check interface syntax
 */
export async function checkInterface(
  connection: IAbapConnection,
  interfaceName: string,
  version: string = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<AxiosResponse> {
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
