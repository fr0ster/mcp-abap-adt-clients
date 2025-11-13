/**
 * Program unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
export async function unlockProgram(
  connection: AbapConnection,
  programName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}

