/**
 * Group Activation operations - activate multiple objects with session support
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Object reference for group activation
 */
export interface ObjectReference {
    uri: string;
    type?: string;
    name: string;
}

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
 *     uri: '/sap/bc/adt/bo/behaviordefinitions/zok_i_cds_test',
 *     type: 'BDEF/BDO',
 *     name: 'ZOK_I_CDS_TEST'
 *   },
 *   {
 *     uri: '/sap/bc/adt/ddic/ddl/sources/zok_c_cds_test',
 *     type: 'DDLS/DF',
 *     name: 'ZOK_C_CDS_TEST'
 *   }
 * ];
 * 
 * const result = await activateObjectsGroup(connection, objects, sessionId);
 * ```
 */
export async function activateObjectsGroup(
    connection: AbapConnection,
    objects: ObjectReference[],
    sessionId: string,
    preauditRequested: boolean = false
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/activation/runs?method=activate&preauditRequested=${preauditRequested}`;

    // Build object references XML
    const objectReferences = objects.map(obj => {
        const typeAttr = obj.type ? ` adtcore:type="${obj.type}"` : '';
        return `  <adtcore:objectReference adtcore:uri="${obj.uri}"${typeAttr} adtcore:name="${obj.name}"/>`;
    }).join('\n');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
${objectReferences}
</adtcore:objectReferences>`;

    const headers = {
        'Accept': 'application/xml',
        'Content-Type': 'application/xml'
    };

    return makeAdtRequestWithSession(
        connection,
        sessionId,
        'POST',
        url,
        xmlBody,
        headers
    );
}
