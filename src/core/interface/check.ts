/**
 * Interface check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

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

  return response;
}
