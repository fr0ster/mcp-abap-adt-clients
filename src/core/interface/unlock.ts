/**
 * Interface unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock interface
 * Must use same session and lock handle from lock operation.
 *
 * A refusal comes back as the transport raised it. It used to be rethrown as a
 * new Error carrying SAP's text alone, which dropped the response and its type
 * — the very thing the caller's `analyse` reads.
 */
export async function unlockInterface(
  connection: IAbapConnection,
  interfaceName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  // Lower-cased like `lock.ts` does. ADT accepts either, but a lock taken at
  // one spelling and released at another cannot be paired by URL — which is
  // how an unreleased lock hides from anyone reading a wire log.
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: getTimeout(),
    data: '',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
