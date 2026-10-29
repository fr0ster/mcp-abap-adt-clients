import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

/**
 * Check access control syntax.
 *
 * One POST to the check-run endpoint, and its report as it arrived. What the
 * report says — findings, a `notProcessed` status, an empty message list — is
 * read by the caller's own strategy.
 *
 * This used to retry once when the report came back `notProcessed` with no
 * findings, on the theory that asynchronous validation had not caught up.
 * Waiting on the server is the caller's decision and the caller's loop.
 */
export async function checkAccessControl(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  accessControlName: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return runCheckRun(
    connection,
    headers,
    { type: 'DCLS/DL', name: accessControlName },
    version,
    'abapCheckRun',
    sourceCode,
  );
}
