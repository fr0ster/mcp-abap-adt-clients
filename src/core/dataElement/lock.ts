/**
 * DataElement lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock data element for modification
 * Returns lock handle that must be used in subsequent requests
 */
export async function lockDataElement(
  connection: IAbapConnection,
  dataElementName: string,
): Promise<string> {
  const dataElementNameEncoded = encodeSapObjectName(
    dataElementName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
  };

  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers,
    timeout: getTimeout('default'),
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}
