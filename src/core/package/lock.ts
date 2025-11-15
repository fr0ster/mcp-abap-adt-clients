/**
 * Package lock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Lock package for modification
 * Returns lock handle that must be used in subsequent requests
 */
export async function lockPackage(
  connection: AbapConnection,
  packageName: string,
  sessionId: string
): Promise<string> {
  const url = `/sap/bc/adt/packages/${encodeSapObjectName(packageName)}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  // Parse lock handle from XML response
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP. Package may be locked by another user.');
  }

  return lockHandle;
}

