/**
 * Lock Function Group operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` on the function group — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member, which looks at the
 * `sap-adt-lm-handle` header first and the body second, as this did. Until
 * 23.0.0 this threw when SAP's answer carried neither, which turned a statement
 * about SAP's answer into a library failure and dropped the answer.
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group (e.g., 'Z_FUGR_TEST_0001')
 * @param sessionId - Optional session ID for tracking
 */
export async function lockFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  _sessionId: string = '',
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_LOCK },
  });
}

/**
 * Unlock a function group
 *
 * @param connection - ABAP connection
 * @param functionGroupName - Name of the function group
 * @param lockHandle - Lock handle from lockFunctionGroup
 * @param sessionId - Optional session ID for tracking
 * @returns IAdtWireResponse from unlock request
 */
export async function unlockFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
  lockHandle: string,
  _sessionId: string = '',
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/functions/groups/${functionGroupName.toLowerCase()}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
