/**
 * Enhancement lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * `POST …?_action=LOCK` on the enhancement — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function lockEnhancement(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  return connection.makeAdtRequest({
    url: `${getEnhancementUri(enhancementType, encodedName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
