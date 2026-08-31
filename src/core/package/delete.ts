/**
 * Package delete operations
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtResponse,
  IDeletePackageParams,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
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
): Promise<IAdtResponse> {
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
export function parsePackageDeletionCheck(response: IAdtResponse): {
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
 * Delete ABAP package using ADT deletion API
 * For packages, empty transportNumber tag may be required
 */
export async function deletePackage(
  connection: IAbapConnection,
  params: IDeletePackageParams,
): Promise<IAdtResponse> {
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

  // Parse response to check if deletion was successful
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  try {
    const result = parser.parse(response.data);
    const deleteObject =
      result['del:deletionResult']?.['del:object'] ||
      result.deletionResult?.object;
    const isDeleted =
      deleteObject?.['@_del:isDeleted'] === 'true' ||
      deleteObject?.['@_isDeleted'] === 'true';

    if (!isDeleted) {
      const messageNode =
        deleteObject?.['del:message'] || deleteObject?.message || {};
      const message =
        messageNode['del:text'] || messageNode.text || 'Deletion failed';
      // The message id travels in the longtext link — `…/messageclass/PAK/
      // messages/058/longtext?…` for "package is already locked" — and it is
      // the only part of this that does not change with the logon language.
      // Carried into the error so a caller can act on the id rather than on
      // English prose.
      const longtext =
        messageNode['atom:link']?.['@_href'] || messageNode.link?.['@_href'];
      const id =
        typeof longtext === 'string'
          ? /messageclass\/([A-Z0-9_]+)\/messages\/(\d+)/i.exec(longtext)
          : null;
      const idPart = id ? ` [${id[1]}/${id[2]}]` : '';
      throw new Error(`Package deletion failed${idPart}: ${message}`);
    }
  } catch (error: unknown) {
    const e = error as HttpError;
    // If parsing fails or isDeleted is false, throw error
    if (e.message?.includes('Package deletion failed')) {
      throw error;
    }
    // If it's a parse error, check HTTP status
    if (response.status >= 400) {
      throw new Error(
        `Package deletion failed: HTTP ${response.status} ${response.statusText}`,
      );
    }
  }

  // Return success response
  return {
    ...response,
    data: {
      success: true,
      package_name: params.package_name,
      object_type: 'DEVC/K',
      object_uri: objectUri,
      transport_request: params.transport_request || 'local',
      message: `Package ${params.package_name} deleted successfully`,
    },
  } as IAdtResponse;
}
