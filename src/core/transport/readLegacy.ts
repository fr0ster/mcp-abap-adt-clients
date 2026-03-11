/**
 * Transport read operations — legacy systems (BASIS < 7.50)
 *
 * Uses /sap/bc/cts/transportrequests instead of /sap/bc/adt/cts/transportrequests
 *
 * Legacy CTS endpoint ignores the transport number in the URL path and always
 * returns the full list of transports for the current user. This function
 * fetches the full list and filters client-side.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP transport request (legacy path)
 *
 * GET /sap/bc/cts/transportrequests always returns the full transport list
 * regardless of the URL path. We filter the XML response client-side to
 * find the requested transport number.
 */
export async function getTransportLegacy(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/cts/transportrequests';

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });

  // Legacy endpoint returns full list — check if requested transport exists
  const data = typeof response.data === 'string' ? response.data : '';

  if (transportNumber && !data.includes(transportNumber)) {
    // Transport not found in the response — simulate 404
    const error = new Error(
      `Transport request ${transportNumber} not found`,
    ) as Error & { response?: { status: number } };
    error.response = { status: 404 };
    throw error;
  }

  return response;
}

/**
 * List all transport requests (legacy path)
 *
 * Returns the full transport list for the current user.
 */
export async function listTransportsLegacy(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  return connection.makeAdtRequest({
    url: '/sap/bc/cts/transportrequests',
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}
