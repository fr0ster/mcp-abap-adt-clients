/**
 * DataElement unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock data element
 * Must use same session and lock handle from lock operation
 */
export async function unlockDataElement(
  connection: AbapConnection,
  dataElementName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const dataElementNameEncoded = encodeSapObjectName(dataElementName.toLowerCase());
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}

