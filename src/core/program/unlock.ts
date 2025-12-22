/**
 * Program unlock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock program
 * Must use same session and lock handle from lock operation
 */
export async function unlockProgram(
  connection: IAbapConnection,
  programName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
