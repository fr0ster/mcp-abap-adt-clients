/**
 * Class unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock class
 * Must use same session and lock handle from lock operation
 * 
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockClass(
  connection: AbapConnection,
  className: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null
  });
}

