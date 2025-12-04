/**
 * Group Activation operations - activate multiple objects with session support
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { buildObjectUri } from '../../utils/activationUtils';
import { ObjectReference } from './types';

/**
 * Activate multiple objects in a group (with session support)
 * 
 * Endpoint: POST /sap/bc/adt/activation/runs?method=activate&preauditRequested=false
 * 
 * This function allows activating multiple objects of different types in a single request.
 * Useful for activating related objects together (e.g., BDEF + CDS view).
 * 
 * @param connection - ABAP connection instance
 * @param objects - Array of objects to activate
 * @param sessionId - Session ID for request tracking
 * @param preauditRequested - Request pre-audit before activation (default: false)
 * @returns Axios response with activation result
 * 
 * @example
 * ```typescript
 * // Activate BDEF and related CDS view together
 * const objects = [
 *   {
 *     type: 'BDEF/BDO',
 *     name: 'ZOK_I_CDS_TEST'
 *   },
 *   {
 *     type: 'DDLS/DF',
 *     name: 'ZOK_C_CDS_TEST'
 *   }
 * ];
 * 
 * const result = await activateObjectsGroup(connection, objects);
 * ```
 */
export async function activateObjectsGroup(
    connection: IAbapConnection,
    objects: ObjectReference[],
    preauditRequested: boolean = false
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;

    // Build object references XML
    const objectReferences = objects.map(obj => {
        const uri = buildObjectUri(obj.name, obj.type);
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
    }).join('\n');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

    const headers = {
        'Accept': 'application/xml',
        'Content-Type': 'application/xml'
    };

    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers
    });
}
