/**
 * Interface check operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check interface syntax
 */
export async function checkInterface(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  interfaceName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  artifactContentType?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    headers,
    'interface',
    interfaceName,
    version,
    'abapCheckRun',
    sourceCode,
    artifactContentType,
  );

  return response;
}
