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
 * Update a transport request's description (read-modify-write pattern).
 *
 * The item resource is `/sap/bc/adt/cts/transportrequests/<NUMBER>`, distinct
 * from the collection URL used by create/list, and takes
 * `application/vnd.sap.adt.transportorganizer.v1+xml` — captured 2026-08-07.
 */
export async function updateTransport(
  connection: IAbapConnection,
  transportNumber: string,
  description: string,
): Promise<IAdtWireResponse> {
  if (!transportNumber) {
    throw new Error('Transport request number is required');
  }
  if (!description) {
    throw new Error('description is required');
  }

  const encodedNumber = encodeSapObjectName(transportNumber);
  const url = `/sap/bc/adt/cts/transportrequests/${encodedNumber}`;

  // 1. GET current XML
  const currentResponse = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT },
  });
  const currentXml = extractXmlString(
    currentResponse.data,
    `transport request ${transportNumber}`,
  );

  // 2. Patch only the description
  const updatedXml = patchXmlAttribute(
    currentXml,
    'tm:desc',
    limitDescription(description),
  );

  // 3. PUT
  const headers = {
    'Content-Type': ACCEPT_TRANSPORT,
    Accept: ACCEPT_TRANSPORT,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: updatedXml,
    headers,
  });
}
