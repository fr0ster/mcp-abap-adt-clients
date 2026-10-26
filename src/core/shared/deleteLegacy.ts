/**
 * Legacy deletion for older SAP systems (BASIS < 7.50)
 *
 * Uses direct DELETE on the object URL with lockHandle,
 * instead of the modern /sap/bc/adt/deletion/check + /deletion/delete API,
 * which 7.40 SP04 does not serve.
 *
 * One request, the DELETE. Measured on 7.40 SP04: a class, a program, an
 * interface and a function group refuse it without the object's lock handle
 * (`400`, "Parameter lockHandle could not be found."); a function module and
 * a DDL source were deleted without one. So the caller locks, passes the
 * handle and unlocks; nothing here locks. The request is sent as given, with
 * or without a handle, and SAP's answer is the answer.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Delete an ADT object via direct DELETE request, under the caller's lock.
 *
 * @param connection - SAP connection
 * @param objectUrl - Full object URL (e.g. /sap/bc/adt/programs/programs/zmy_prog)
 * @param lockHandle - The handle from the caller's `lock()`; required by four of
 *   the six types on 7.40 SP04, and sent only when given
 * @param transportRequest - Optional transport request number, sent as `corrNr`
 *   (not measured on 7.40 SP04: every probe ran in a local package)
 */
export async function deleteObjectDirect(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  objectUrl: string,
  lockHandle: string | undefined,
  transportRequest?: string,
) {
  const url = `${objectUrl}${writeQuery(lockHandle, transportRequest?.trim())}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    headers: requestHeaders(headers),
    timeout: 0,
    data: null,
  });
}
