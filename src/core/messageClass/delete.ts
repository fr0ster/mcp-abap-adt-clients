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

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

const objectUri = (name: string): string =>
  `${BASE}/${encodeSapObjectName(name.toLowerCase())}`;

/**
 * Low-level: check whether the message class can be deleted.
 * POST /sap/bc/adt/deletion/check
 */
export async function checkDeletion(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtResponse> {
  if (!name) throw new Error('name is required');

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}"/>
</del:checkRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/check',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION_CHECK,
      'Content-Type': CT_DELETION_CHECK,
    },
  });
}

/**
 * Low-level: delete the message class via the deletion service.
 * POST /sap/bc/adt/deletion/delete (stateless — no lock handle).
 *
 * corrNr / transport_request is intentionally omitted — local/no-transport path
 * only, wired for transportable packages in the corrNr task.
 */
export async function deleteMessageClass(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtResponse> {
  if (!name) throw new Error('name is required');

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(name)}">
    <del:transportNumber/>
  </del:object>
</del:deletionRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/delete',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION,
      'Content-Type': CT_DELETION,
    },
  });
}
