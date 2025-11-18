/**
 * Lock Function Group operations
 */

import type { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { XMLParser } from 'fast-xml-parser';

/**
 * Lock a function group for editing
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group (e.g., 'Z_FUGR_TEST_0001')
 * @param sessionId - Optional session ID for tracking
 * @returns Lock handle string
 */
export async function lockFunctionGroup(
  connection: AbapConnection,
  functionGroupName: string,
  sessionId: string = ''
): Promise<string> {
  const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  // Extract lock handle from response header
  const lockHandle = response.headers['sap-adt-lm-handle'];
  if (!lockHandle) {
    // Try parsing from XML body if header not present
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const result = parser.parse(response.data);
    const xmlLockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

    if (!xmlLockHandle) {
      throw new Error('Failed to acquire lock: no lock handle in response');
    }
    return xmlLockHandle;
  }

  return lockHandle;
}

/**
 * Unlock a function group
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group
 * @param lockHandle - Lock handle from lockFunctionGroup
 * @param sessionId - Optional session ID for tracking
 * @returns AxiosResponse from unlock request
 */
export async function unlockFunctionGroup(
  connection: AbapConnection,
  functionGroupName: string,
  lockHandle: string,
  sessionId: string = ''
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}
