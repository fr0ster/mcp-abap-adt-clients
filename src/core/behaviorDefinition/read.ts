/**
 * Behavior Definition read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Read behavior definition metadata
 * 
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}?version=inactive
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with behavior definition metadata (XML)
 * 
 * @example
 * ```typescript
 * const response = await read(connection, 'Z_MY_BDEF', sessionId);
 * // Response contains metadata in blue:blueSource XML format
 * ```
 */
export async function read(
    connection: IAbapConnection,
    name: string,
    sessionId: string,
    version: string = 'inactive'
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}?version=${version}`;

    const headers = {
        'Accept': 'application/vnd.sap.adt.blues.v1+xml'
    };

    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers
    });
}

/**
 * Read behavior definition source code
 * 
 * Endpoint: GET /sap/bc/adt/bo/behaviordefinitions/{name}/source/main
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read (default: inactive)
 * @returns Axios response with source code (plain text)
 * 
 * @example
 * ```typescript
 * const response = await readSource(connection, 'Z_MY_BDEF', sessionId);
 * const sourceCode = response.data; // BDEF source code
 * ```
 */
export async function readSource(
    connection: IAbapConnection,
    name: string,
    version: string = 'inactive'
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}/source/main?version=${version}`;

    const headers = {
        'Accept': 'text/plain'
    };

    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers
    });
}

/**
 * Get transport request for ABAP behavior definition
 * @param connection - SAP connection
 * @param name - Behavior definition name
 * @returns Transport request information
 */
export async function getBehaviorDefinitionTransport(
    connection: IAbapConnection,
    name: string
): Promise<AxiosResponse> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}/transport`;

    const headers = {
        'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    };

    return connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers
    });
}
