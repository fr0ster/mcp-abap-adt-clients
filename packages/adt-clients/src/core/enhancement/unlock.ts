/**
 * Enhancement unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * Unlock enhancement
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxhb, enhoxhh, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param lockHandle - Lock handle obtained from lockEnhancement
 * @returns Axios response
 */
export async function unlockEnhancement(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${getEnhancementUri(enhancementType, enhancementName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: null,
  });
}
