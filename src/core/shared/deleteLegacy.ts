/**
 * Legacy deletion for older SAP systems (BASIS < 7.50)
 *
 * Uses direct DELETE on the object URL with lockHandle,
 * instead of the modern /sap/bc/adt/deletion/check + /deletion/delete API.
 *
 * Flow: lock → DELETE {objectUrl}?lockHandle=... → unlock on failure
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

/**
 * Delete an ADT object via direct DELETE request.
 * Requires a lock handle obtained from the object's lock function.
 *
 * @param connection - SAP connection
 * @param objectUrl - Full object URL (e.g. /sap/bc/adt/programs/programs/zmy_prog)
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request number
 */
export async function deleteObjectDirect(
  connection: IAbapConnection,
  objectUrl: string,
  lockHandle: string,
  transportRequest?: string,
) {
  const params = [`lockHandle=${encodeURIComponent(lockHandle)}`];
  if (transportRequest?.trim()) {
    params.push(`corrNr=${transportRequest}`);
  }
  const url = `${objectUrl}?${params.join('&')}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    timeout: getTimeout('default'),
    data: null,
  });
}
