/**
 * The deletion check, asked by object URI.
 *
 * Every type's own `checkDeletion` builds the same request — one POST to
 * `/sap/bc/adt/deletion/check` carrying a `<del:object adtcore:uri="…"/>` — and
 * differs only in the URI it puts there. Twenty-two modules each carry their own
 * copy of it, which is duplication this file does not expand: the types that had
 * no copy use this instead of gaining a twenty-third.
 *
 * Measured on one system, 2026-09-06, asking about a message class:
 *
 * ```
 * POST /sap/bc/adt/deletion/check
 * <del:checkRequest …><del:object adtcore:uri="/sap/bc/adt/messageclass/z_msg_test_0001"/></del:checkRequest>
 *
 * 200 <del:checkResponse …><del:object del:isDeletable="true"
 *       adtcore:type="MSAG/N" adtcore:packageName="ZBASE_PROBE01"> … </del:object>
 * ```
 *
 * The answer names the type and the package it resolved the URI to, which is
 * what makes a URI the whole of the question: the service is asked about an
 * address, not about a kind of object.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION_CHECK,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function checkDeletionByUri(
  connection: IAbapConnection,
  objectUri: string,
): Promise<IAdtWireResponse> {
  if (!objectUri) {
    throw new Error('objectUri is required');
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
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
