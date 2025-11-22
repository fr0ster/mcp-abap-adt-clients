/**
 * Package unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock package
 * Must use same lock handle from lock operation
 * 
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockPackage(
  connection: AbapConnection,
  packageName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/packages/${encodeSapObjectName(packageName)}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null
  });
}

