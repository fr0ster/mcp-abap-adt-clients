/**
 * Transport read operations — legacy systems (BASIS < 7.50)
 *
 * Uses /sap/bc/cts/transportrequests instead of /sap/bc/adt/cts/transportrequests
 *
 * Legacy CTS endpoint ignores the transport number in the URL path and always
 * returns the full list of transports for the current user. It is answered
 * as it arrived; nothing here filters it.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP transport request (legacy path)
 *
 * GET /sap/bc/cts/transportrequests always returns the full transport list
 * regardless of the URL path, so there is nothing in the request to name the
 * one wanted. The list is answered as it arrived; picking the request out of
 * it — or calling its absence a failure — is the reading's and the caller's
 * `analyse`. Until 23.0.0 an answer not mentioning the number was thrown as a
 * fabricated `{ response: { status: 404 } }`, a status SAP never sent, with
 * SAP's actual answer dropped.
 */
export async function getTransportLegacy(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: '/sap/bc/cts/transportrequests',
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}

/**
 * List all transport requests (legacy path)
 *
 * Returns the full transport list for the current user.
 */
export async function listTransportsLegacy(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: '/sap/bc/cts/transportrequests',
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}
