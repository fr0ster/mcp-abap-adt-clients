/**
 * Package delete operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeletePackageParams } from './types';

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
 * Delete ABAP package using ADT deletion API
 * For packages, empty transportNumber tag may be required
 */
export async function deletePackage(
  connection: IAbapConnection,
  params: IDeletePackageParams,
): Promise<IAdtWireResponse> {
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
