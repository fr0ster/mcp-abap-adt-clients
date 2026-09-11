/**
 * Transport request update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch the description → PUT.
 * ADT's only mutable field on a transport request is its description; every
 * other attribute (owner, type, target, tasks, links) is server-managed and
 * would be lost if the PUT body were built from scratch instead of patched
 * into the GET response. Same reasoning as `../package/update.ts`, against the
 * same server.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { extractXmlString, patchXmlAttribute } from '../../utils/xmlPatch';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * A field left out of `document` is not preserved: nothing was read to preserve
 * it from.
 */
export async function updateTransport(
  connection: IAbapConnection,
  transportNumber: string,
  document: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/cts/transportrequests/${encodeSapObjectName(transportNumber)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      'Content-Type': ACCEPT_TRANSPORT,
      Accept: ACCEPT_TRANSPORT,
    },
  });
}
