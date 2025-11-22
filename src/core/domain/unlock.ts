/**
 * Domain unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock domain
 * Must use same session and lock handle from lock operation
 * 
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockDomain(
  connection: AbapConnection,
  domainName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null
  });
}

