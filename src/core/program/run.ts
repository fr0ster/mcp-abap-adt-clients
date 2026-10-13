/**
 * Program run operations - execute ABAP executable programs
 */

import type { IDebuggeeIds } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { debuggeePassport } from '../../runtime/debugger/passport';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Run an ABAP executable program.
 *
 * Endpoint: POST /sap/bc/adt/programs/programrun/{programName}
 */
export async function runProgram(
  connection: IAbapConnection,
  programName: string,
  _sessionId?: string,
  debuggee?: IDebuggeeIds,
): Promise<IAdtWireResponse> {
  const normalizedName = encodeSapObjectName(programName).toUpperCase();

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/programs/programrun/${normalizedName}`,
    method: 'POST',
    timeout: 0,
    headers: {
      Accept: ACCEPT_SOURCE,
      'X-sap-adt-profiling': 'server-time',
      ...(debuggee && { 'SAP-PASSPORT': debuggeePassport(debuggee) }),
    },
  });
}
