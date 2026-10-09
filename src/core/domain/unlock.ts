/**
 * Domain unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DOMAIN } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock domain
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 */
export async function unlockDomain(
  connection: IAbapConnection,
  domainName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${DOMAIN.uri(domainName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
