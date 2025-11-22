/**
 * Behavior Definition update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

/**
 * Update behavior definition source code
 * 
 * Endpoint: PUT /sap/bc/adt/bo/behaviordefinitions/{name}/source/main?lockHandle={handle}
 * 
 * Requires behavior definition to be locked first
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param source - BDEF source code
 * @param lockHandle - Lock handle from lock operation
 * @param sessionId - Session ID for request tracking
 * @param transportRequest - Optional transport request number
 * @returns Axios response with updated source code
 * 
 * @example
 * ```typescript
 * const source = `managed implementation in class zbp_my_bdef unique;
 * strict ( 2 );
 * 
 * define behavior for Z_MY_ENTITY
 * persistent table z_my_table
 * lock master
 * authorization master ( instance )
 * {
 *   create;
 *   update;
 *   delete;
 * }`;
 * 
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * await update(connection, 'Z_MY_BDEF', source, lockHandle, sessionId);
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
export async function update(
    connection: AbapConnection,
    name: string,
    source: string,
    lockHandle: string,
    transportRequest?: string
): Promise<AxiosResponse> {
    if (!source) {
        throw new Error('source is required');
    }

    if (!lockHandle) {
        throw new Error('lockHandle is required');
    }

    let url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}/source/main?lockHandle=${lockHandle}`;
    if (transportRequest) {
        url += `&corrNr=${transportRequest}`;
    }

    const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'text/plain'
    };

    return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: source,
        headers
    });
}
