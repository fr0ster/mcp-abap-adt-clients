/**
 * Program unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
export async function unlockProgram(
  connection: AbapConnection,
  programName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({url, method: 'POST', timeout: getTimeout('default'), data: null});
}

