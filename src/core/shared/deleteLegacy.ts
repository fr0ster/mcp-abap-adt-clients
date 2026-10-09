/**
 * Legacy deletion for older SAP systems (BASIS < 7.50)
 *
 * Uses direct DELETE on the object URL with lockHandle,
 * instead of the modern /sap/bc/adt/deletion/check + /deletion/delete API.
 *
 * One request, the DELETE. A delete needs no lock; `lockHandle` is passed
 * through only when the caller gives one.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Delete an ADT object via direct DELETE request. No lock is needed.
 *
 * @param connection - SAP connection
 * @param objectUrl - Full object URL (e.g. /sap/bc/adt/programs/programs/zmy_prog)
 * @param lockHandle - Passed through when the caller holds one; optional
 * @param transportRequest - Optional transport request number
 */
export async function deleteObjectDirect(
  connection: IAbapConnection,
  objectUrl: string,
  lockHandle: string | undefined,
  transportRequest?: string,
) {
  const url = `${objectUrl}${writeQuery(lockHandle, transportRequest?.trim())}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    timeout: getTimeout('default'),
    data: null,
  });
}
