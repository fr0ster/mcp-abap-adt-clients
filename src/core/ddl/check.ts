/**
 * View check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check view (DDLS) syntax.
 *
 * One POST to the check-run endpoint, and its report as it arrived.
 *
 * This used to retry once when the report came back `notProcessed` saying the
 * data definition did not exist, on the theory that an inactive version had not
 * materialised yet. That is a wait, and a wait belongs to the caller.
 */
export async function checkDdl(
  connection: IAbapConnection,
  ddlName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return runCheckRun(
    connection,
    'view',
    ddlName,
    version,
    'abapCheckRun',
    sourceCode,
  );
}
