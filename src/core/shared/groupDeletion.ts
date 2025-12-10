/**
 * Group Deletion operations - delete multiple objects with session support
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { buildObjectUri } from '../../utils/activationUtils';
import { IObjectReference } from './types';

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
    objects: IObjectReference[]
): Promise<AxiosResponse> {
    const checkUrl = `/sap/bc/adt/deletion/check`;

    // Build object URIs
    const objectElements = objects.map(obj => {
        const uri = buildObjectUri(obj.name, obj.type);
        return `  <del:object adtcore:uri="${uri}"/>`;
    }).join('\n');

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
${objectElements}
</del:checkRequest>`;

    const headers = {
        'Accept': 'application/vnd.sap.adt.deletion.check.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml'
    };

    return connection.makeAdtRequest({
        url: checkUrl,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlPayload,
        headers
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
    transportRequest?: string
): Promise<AxiosResponse> {
    const deletionUrl = `/sap/bc/adt/deletion/delete`;

    // Build object URIs with transport number
    const transportNumberTag = transportRequest && transportRequest.trim()
        ? `<del:transportNumber>${transportRequest}</del:transportNumber>`
        : '<del:transportNumber/>';

    const objectElements = objects.map(obj => {
        const uri = buildObjectUri(obj.name, obj.type);
        return `  <del:object adtcore:uri="${uri}">
    ${transportNumberTag}
  </del:object>`;
    }).join('\n');

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
${objectElements}
</del:deletionRequest>`;

    const headers = {
        'Accept': 'application/vnd.sap.adt.deletion.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml'
    };

    return connection.makeAdtRequest({
        url: deletionUrl,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlPayload,
        headers
    });
}

