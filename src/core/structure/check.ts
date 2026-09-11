/**
 * Structure check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check structure syntax
 * Note: For DDIC objects like structures, check may not be fully supported in all SAP systems.
 * If check fails with "inactive version does not exist" or "importing from database" error, it's often safe to skip.
 */
export async function checkStructure(
  connection: IAbapConnection,
  structureName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'structure',
    structureName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  return response;
}
