/**
 * DataElement unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DATA_ELEMENT } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
export async function unlockDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${DATA_ELEMENT.uri(dataElementName.toLowerCase())}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
