/**
 * Lock Function Group operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { headerValueToString } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock a function group for editing
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group (e.g., 'Z_FUGR_TEST_0001')
 * @param sessionId - Optional session ID for tracking
 * @returns Lock handle string
 */
export async function lockFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  _sessionId: string = '',
): Promise<string> {
  const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });

  // Extract lock handle from response header
  const lockHandle = headerValueToString(response.headers['sap-adt-lm-handle']);
  if (!lockHandle) {
    // Try parsing from XML body if header not present
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const result = parser.parse(response.data);
    const xmlLockHandle =
      result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

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
  connection: IAbapConnection,
  functionGroupName: string,
  lockHandle: string,
  _sessionId: string = '',
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
