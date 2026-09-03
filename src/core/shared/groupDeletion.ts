/**
 * Group Deletion operations - delete multiple objects with session support
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { buildObjectUri } from '../../utils/activationUtils';
import { AdtSAPError } from '../../utils/adtErrors';
import { getTimeout } from '../../utils/timeouts';

const deletionParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
});

import type { IObjectReference } from './types';

/**
 * Check if multiple objects can be deleted (group deletion check)
 *
 * Endpoint: POST /sap/bc/adt/deletion/check
 *
 * This function allows checking deletion for multiple objects of different types in a single request.
 * Useful for checking related objects together (e.g., view + table).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to check for deletion
 * @returns Axios response with deletion check result
 *
 * @example
 * ```typescript
 * // Check deletion for view and table together
 * const objects = [
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZADT_BLD_VIEW02'
 *   },
 *   {
 *     type: 'TABL/DT',
 *     name: 'ZADT_VIEW_TBL02'
 *   }
 * ];
 *
 * const result = await checkDeletionGroup(connection, objects);
 * ```
 */
export async function checkDeletionGroup(
  connection: IAbapConnection,
  objects: IObjectReference[],
): Promise<IAdtWireResponse> {
  const checkUrl = `/sap/bc/adt/deletion/check`;

  // Build object URIs
  const objectElements = objects
    .map((obj) => {
      const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
      return `  <del:object adtcore:uri="${uri}"/>`;
    })
    .join('\n');

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
${objectElements}
</del:checkRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION_CHECK,
    'Content-Type': CT_DELETION_CHECK,
  };

  return connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Delete multiple objects in a group (with session support)
 *
 * Endpoint: POST /sap/bc/adt/deletion/delete
 *
 * This function allows deleting multiple objects of different types in a single request.
 * Useful for deleting related objects together (e.g., view + table).
 *
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to delete
 * @param transportRequest - Optional transport request number
 * @returns Axios response with deletion result
 *
 * @example
 * ```typescript
 * // Delete view and table together
 * const objects = [
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZADT_BLD_VIEW02'
 *   },
 *   {
 *     type: 'TABL/DT',
 *     name: 'ZADT_VIEW_TBL02'
 *   }
 * ];
 *
 * const result = await deleteObjectsGroup(connection, objects);
 * ```
 */
export async function deleteObjectsGroup(
  connection: IAbapConnection,
  objects: IObjectReference[],
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Build object URIs with transport number
  const transportNumberTag = transportRequest?.trim()
    ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
    : '<del:transportNumber/>';

  const objectElements = objects
    .map((obj) => {
      const uri = buildObjectUri(obj.name, obj.type, obj.parentName);
      return `  <del:object adtcore:uri="${uri}">
    ${transportNumberTag}
  </del:object>`;
    })
    .join('\n');

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
${objectElements}
</del:deletionRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION,
    'Content-Type': CT_DELETION,
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });

  assertDeletionSucceeded(response, deletionUrl);
  return response;
}

/**
 * A deletion that did not delete is a failure, whatever the status says.
 *
 * ADT answers this endpoint with **200** and a document that reports per object:
 *
 * ```xml
 * <del:object del:isDeletable="false" adtcore:name="ZADT_BLD_PKG03">
 *   <del:message del:type="E"><del:text>Package contains 2 objects</del:text></del:message>
 * </del:object>
 * ```
 *
 * The transport succeeded, the body is not an `<exc:exception>`, so the refusal
 * check at the connection boundary passes it through and the caller was handed
 * `ok: true` for objects that are still there.
 *
 * **The check endpoint is deliberately not treated this way.** Asked "can this be
 * deleted", `isDeletable="false"` is the answer to the question, not a failure to
 * answer it — the same reason a probe's "not found" is a result. Only a *delete*
 * that reports objects left behind is a failure, because there the caller asked
 * for something and did not get it.
 *
 * `del:text` is quoted verbatim: "Package contains 2 objects" is what a caller
 * can act on, and it is the server's sentence rather than ours.
 */
function assertDeletionSucceeded(
  response: IAdtWireResponse,
  url: string,
): void {
  const body = response?.data;
  if (typeof body !== 'string' || body.trim() === '') {
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = deletionParser.parse(body) as Record<string, unknown>;
  } catch {
    // Unreadable is not the same as refused, and this function answers only the
    // second question. A document nobody can parse is `AdtParseError`'s case.
    return;
  }

  const result = (parsed['del:deletionResult'] ?? parsed.deletionResult) as
    | Record<string, unknown>
    | undefined;
  const raw = result?.['del:object'] ?? result?.object;
  const objects = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const refused: string[] = [];
  for (const entry of objects as Record<string, unknown>[]) {
    const deleted =
      entry['del:isDeleted'] === 'true' || entry.isDeleted === 'true';
    if (deleted) {
      continue;
    }
    const messageNode = (entry['del:message'] ?? entry.message ?? {}) as Record<
      string,
      unknown
    >;
    const text = messageNode['del:text'] ?? messageNode.text;
    const name = entry['adtcore:name'] ?? entry.name ?? entry['del:name'];
    refused.push(
      `${name ? `${String(name)}: ` : ''}${
        typeof text === 'string' && text.trim()
          ? text.trim()
          : 'not deleted, and the server gave no reason'
      }`,
    );
  }

  if (refused.length > 0) {
    throw new AdtSAPError(
      `SAP refused the request: ${refused.join('; ')}`,
      body,
      undefined,
      undefined,
      response,
      { method: 'POST', url },
    );
  }
}
