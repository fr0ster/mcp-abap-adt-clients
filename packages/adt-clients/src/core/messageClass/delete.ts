/**
 * Message class delete operations.
 *
 * Uses the stateless ADT deletion service (`/sap/bc/adt/deletion/check` +
 * `/sap/bc/adt/deletion/delete`) — the same mechanism Eclipse ADT and the other
 * object types (domain, serviceDefinition, …) use. A direct
 * `DELETE /messageclass/{name}?lockHandle=` leaves a lingering message-editing
 * enqueue ("User is currently editing …") that blocks a same-name re-create, so
 * it is NOT used here.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { MESSAGE_CLASS } from '../../endpoints/objects';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

const BASE = MESSAGE_CLASS.collection;

const objectUri = (name: string): string =>
  `${BASE}/${encodeSapObjectName(name.toLowerCase())}`;

/**
 * Low-level: check whether the message class can be deleted.
 * POST /sap/bc/adt/deletion/check
 */
export async function checkDeletion(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
): Promise<IAdtWireResponse> {
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}"/>
</del:checkRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/check',
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}

/**
 * Low-level: delete the message class via the deletion service.
 * POST /sap/bc/adt/deletion/delete (stateless — no lock handle).
 *
 * For a transportable package pass `transportRequest` (emitted as
 * `<del:transportNumber>`), like domain; local packages send an empty tag.
 */
export async function deleteMessageClass(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const transportNumberTag = transportRequest?.trim()
    ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/delete',
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}
