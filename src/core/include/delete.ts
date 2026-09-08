/**
 * Include delete — the deletion service, like every other ADT deletion.
 *
 * This file used to send `DELETE /programs/includes/<name>?lockHandle=…` and
 * say in this very comment that a lock is required "like every other ADT
 * deletion". Both halves were wrong. A lock is what an *update* needs; a
 * deletion is a check followed by the deletion service, and an existing lock
 * does not enable the delete — it blocks it.
 *
 * Measured on E19, 2026-09-07, on the `ZAC_INCL01` left behind by the suite
 * this bug was breaking. No lock taken anywhere, no session made stateful:
 *
 * ```
 * POST /sap/bc/adt/deletion/check
 *   <del:object adtcore:uri="/sap/bc/adt/programs/includes/zac_incl01"/>
 *   200 del:isDeletable="true" adtcore:type="PROG/I" externalStrongReferences="0"
 *
 * POST /sap/bc/adt/deletion/delete
 *   <del:object adtcore:uri="…"><del:transportNumber/></del:object>
 *   200 del:isDeleted="true"
 * ```
 *
 * The old path answered `400 Parameter lockHandle could not be found` whenever
 * the caller had no handle to give — which is every cleanup, since nothing
 * locks an object in order to remove it. That is what failed
 * `Include - Full workflow` on both transports.
 *
 * The response is handed back as it arrived. `200` here means the service
 * accepted the request, not that the object is gone: the verdict is
 * `del:isDeleted` in the body, and reading it is the caller's question.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_DELETION, CT_DELETION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { includeUrl } from './lock';

export async function deleteInclude(
  connection: IAbapConnection,
  includeName: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const transportNumberTag = transportRequest?.trim()
    ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${includeUrl(includeName)}">
    ${transportNumberTag}
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
