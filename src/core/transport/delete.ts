/**
 * Transport request delete operations
 *
 * ADT deletes a transport request only while it is empty — a request still
 * holding objects is rejected by the server, not by this client. The item
 * resource is the same one `read.ts` and `update.ts` use, distinct from the
 * collection URL.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Delete an (empty) transport request.
 *
 * `DELETE /sap/bc/adt/cts/transportrequests/<NUMBER>` — captured 2026-08-07.
 */
export async function deleteTransport(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<IAdtResponse> {
  if (!transportNumber) {
    throw new Error('Transport request number is required');
  }

  const encodedNumber = encodeSapObjectName(transportNumber);
  const url = `/sap/bc/adt/cts/transportrequests/${encodedNumber}`;

  return connection.makeAdtRequest({
    url,
    method: 'DELETE',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT },
  });
}
