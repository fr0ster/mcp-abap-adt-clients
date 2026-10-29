/**
 * Structure check operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check structure syntax
 * Note: For DDIC objects like structures, check may not be fully supported in all SAP systems.
 * If check fails with "inactive version does not exist" or "importing from database" error, it's often safe to skip.
 */
export async function checkStructure(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  structureName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    headers,
    { type: 'TABL/DS', name: structureName },
    version,
    'abapCheckRun',
    sourceCode,
  );
  return response;
}
