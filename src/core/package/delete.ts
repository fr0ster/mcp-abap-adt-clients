/**
 * Package delete operations
 */

import type {
  AdtNoFailure,
  HttpError,
  IAbapConnection,
  IAdtError,
  IAdtWireResponse,
  IDeletePackageParams,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { requestOf } from '../../utils/requestTrace';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check if package can be deleted (deletion check)
 * Returns response with isDeletable flag
 *
 * NOTE: Uses stateful session headers automatically if connection has stateful mode enabled
 */
export async function checkPackageDeletion(
  connection: IAbapConnection,
  params: IDeletePackageParams,
): Promise<IAdtWireResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const encodedName = encodeSapObjectName(params.package_name.toLowerCase());
  const objectUri = `/sap/bc/adt/packages/${encodedName}`;

  const checkUrl = `/sap/bc/adt/deletion/check`;

  // Build XML check request (no transportNumber in check request)
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION_CHECK,
    'Content-Type': CT_DELETION_CHECK,
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Parse deletion check response to get isDeletable flag
 */
export function parsePackageDeletionCheck(response: IAdtWireResponse): {
  isDeletable: boolean;
  message?: string;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  try {
    const result = parser.parse(response.data);
    const checkObject =
      result['del:checkResponse']?.['del:object'] ||
      result.checkResponse?.object;

    if (!checkObject) {
      return { isDeletable: false, message: 'No check result in response' };
    }

    const isDeletable =
      checkObject['@_del:isDeletable'] === 'true' ||
      checkObject['@_isDeletable'] === 'true';
    const message =
      checkObject['del:message']?.['del:text'] ||
      checkObject.message?.text ||
      '';

    return { isDeletable, message: message || undefined };
  } catch (error) {
    return {
      isDeletable: false,
      message: `Failed to parse check response: ${error}`,
    };
  }
}

/**
 * The verdict a package **deletion** carries, as an error strategy.
 *
 * Not {@link deletionRefusal}: that reads a *check* response, whose verdict is
 * `del:isDeletable`. A deletion answers `del:deletionResult` with
 * `del:isDeleted`, and running the check parser over it found no `isDeletable`
 * at all — so a successful delete was reported as a refusal, on the one handler
 * that used it for both steps.
 *
 * The message id travels in the longtext link — `…/messageclass/PAK/messages/
 * 058/longtext?…` for "package is already locked" — and is the only part that
 * does not change with the logon language, so it is carried into the message a
 * caller reads.
 */
export const packageDeletionRefusal = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict !== ADT_NO_FAILURE) return verdict;

  const xml = typeof answer?.data === 'string' ? answer.data : '';
  // Nothing to read is not a refusal. ADT answers some deletions with an empty
  // body, and inventing a "no" from silence is what the check parser did here.
  if (!xml.trim()) return ADT_NO_FAILURE;

  let deleteObject: Record<string, unknown> | undefined;
  try {
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    }).parse(xml) as Record<string, Record<string, unknown>>;
    deleteObject = (parsed['del:deletionResult']?.['del:object'] ??
      parsed.deletionResult?.object) as Record<string, unknown> | undefined;
  } catch {
    // A body that will not parse says nothing about the deletion either.
    return ADT_NO_FAILURE;
  }

  if (!deleteObject) return ADT_NO_FAILURE;
  const isDeleted =
    deleteObject['@_del:isDeleted'] === 'true' ||
    deleteObject['@_isDeleted'] === 'true';
  if (isDeleted) return ADT_NO_FAILURE;

  const messageNode = (deleteObject['del:message'] ??
    deleteObject.message ??
    {}) as Record<string, unknown>;
  const text =
    (messageNode['del:text'] as string) ??
    (messageNode.text as string) ??
    'Deletion failed';
  const longtext =
    ((messageNode['atom:link'] as Record<string, unknown>)?.['@_href'] as
      | string
      | undefined) ??
    ((messageNode.link as Record<string, unknown>)?.['@_href'] as
      | string
      | undefined);
  const id =
    typeof longtext === 'string'
      ? /messageclass\/([A-Z0-9_]+)\/messages\/(\d+)/i.exec(longtext)
      : null;

  return {
    origin: 'refusal',
    message: `Package deletion failed${id ? ` [${id[1]}/${id[2]}]` : ''}: ${text}`,
    response: answer,
    request: requestOf(answer),
  };
};

/**
 * Delete ABAP package using ADT deletion API
 * For packages, empty transportNumber tag may be required
 */
export async function deletePackage(
  connection: IAbapConnection,
  params: IDeletePackageParams,
): Promise<IAdtWireResponse> {
  if (!params.package_name) {
    throw new Error('package_name is required');
  }

  const encodedName = encodeSapObjectName(params.package_name.toLowerCase());
  const objectUri = `/sap/bc/adt/packages/${encodedName}`;

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  // Build XML deletion request
  // For packages, empty transportNumber tag may be required if no transport_request provided
  let transportNumberTag = '';
  if (params.transport_request?.trim()) {
    transportNumberTag = `<del:transportNumber>${params.transport_request}</del:transportNumber>`;
  } else {
    // For packages: add empty self-closing tag
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
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

  // The response, as it arrived. This used to replace the server's document
  // with `{ success: true, …, message: '… deleted successfully' }` — prose this
  // library wrote about a call it had not read, handed to a caller in place of
  // what SAP said. What a caller wants out of the answer is the reading's
  // question; the writer's job is to hand the answer over.
  return response;
}
