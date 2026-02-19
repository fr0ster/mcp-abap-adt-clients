/**
 * Program run operations - execute ABAP executable programs
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Run an ABAP executable program.
 *
 * Endpoint: POST /sap/bc/adt/programs/programrun/{programName}
 */
export async function runProgram(
  connection: IAbapConnection,
  programName: string,
  _sessionId?: string,
): Promise<AxiosResponse> {
  if (!programName?.trim()) {
    throw new Error('programName is required');
  }

  const normalizedName = encodeSapObjectName(programName).toUpperCase();

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/programs/programrun/${normalizedName}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'text/plain',
      'X-sap-adt-profiling': 'server-time',
    },
  });
}
