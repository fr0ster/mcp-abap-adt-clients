/**
 * Behavior Definition unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

/**
 * Unlock behavior definition
 * 
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=UNLOCK&lockHandle={handle}
 * 
 * Must use same session and lock handle from lock operation
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param lockHandle - Lock handle obtained from lock operation
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 * 
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // ... perform updates ...
 * await unlock(connection, 'Z_MY_BDEF', lockHandle, sessionId);
 * ```
 */
export async function unlock(
    connection: AbapConnection,
    name: string,
    lockHandle: string,
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default')
    });
}
