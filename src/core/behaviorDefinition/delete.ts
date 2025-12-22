/**
 * Behavior Definition delete operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check if behavior definition can be deleted
 *
 * Endpoint: POST /sap/bc/adt/deletion/check
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with deletion check result
 *
 * @example
 * ```typescript
 * const checkResult = await checkDeletion(connection, 'Z_MY_BDEF', sessionId);
 * // Check if deletable
 * const isDeletable = checkResult.data.match(/del:isDeletable="true"/);
 * ```
 */
export async function checkDeletion(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
    <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml',
  };

  const checkUrl = `/sap/bc/adt/deletion/check`;

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Delete behavior definition
 *
 * Endpoint: POST /sap/bc/adt/deletion/delete
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param transportRequest - Optional transport request number
 * @returns Axios response with deletion result
 *
 * @example
 * ```typescript
 * // Check first
 * await checkDeletion(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Then delete
 * await deleteBehaviorDefinition(connection, 'Z_MY_BDEF', sessionId, 'DEVK900123');
 * ```
 */
export async function deleteBehaviorDefinition(
  connection: IAbapConnection,
  name: string,
  transportRequest?: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}`;

  const transportXml = transportRequest
    ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
    <del:object adtcore:uri="${objectUri}">
        ${transportXml}
    </del:object>
</del:deletionRequest>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
  };

  const deletionUrl = `/sap/bc/adt/deletion/delete`;

  return await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}
