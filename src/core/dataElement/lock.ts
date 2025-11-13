/**
 * DataElement lock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Acquire lock handle for update
 */
export async function acquireLockHandleForUpdate(
  connection: AbapConnection,
  dataElementName: string,
  sessionId: string
): Promise<string> {
  const dataElementNameEncoded = encodeSapObjectName(dataElementName.toLowerCase());
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });

  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}

