/**
 * Enhancement unlock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * Unlock enhancement
 * Must use same session and lock handle from lock operation
 *
 * NOTE: Caller should disable stateful session mode via connection.setSessionType("stateless")
 * after calling this function
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @param lockHandle - Lock handle obtained from lockEnhancement
 * @returns Axios response
 */
export async function unlockEnhancement(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  const url = `${getEnhancementUri(enhancementType, encodedName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
  });
}
