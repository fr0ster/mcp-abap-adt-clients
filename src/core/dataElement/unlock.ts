/**
 * DataElement unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
export async function unlockDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const dataElementNameEncoded = encodeSapObjectName(
    dataElementName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
