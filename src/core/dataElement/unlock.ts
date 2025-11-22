/**
 * DataElement unlock operations
 * NOTE: Builder should call connection.setSessionType("stateless") after unlocking
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
export async function unlockDataElement(
  connection: AbapConnection,
  dataElementName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const dataElementNameEncoded = encodeSapObjectName(dataElementName.toLowerCase());
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default')
  });
}