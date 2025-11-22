/**
 * Behavior Definition check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { CheckReporter } from './types';

/**
 * Run check on behavior definition
 * 
 * Endpoint: POST /sap/bc/adt/checkruns?reporters={reporter}
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param reporter - Check reporter type
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @returns Axios response with check results (XML)
 * 
 * @example
 * ```typescript
 * // Check implementation
 * const implResult = await check(connection, 'Z_MY_BDEF', 'bdefImplementationCheck', sessionId);
 * 
 * // Check ABAP syntax
 * const syntaxResult = await check(connection, 'Z_MY_BDEF', 'abapCheckRun', sessionId);
 * ```
 */
export async function check(
    connection: AbapConnection,
    name: string,
    reporter: CheckReporter,
    sessionId: string,
    version: string = 'inactive'
): Promise<AxiosResponse> {
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;

    const headers = {
        'Accept': 'application/vnd.sap.adt.checkmessages+xml',
        'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
    };

    const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

    return makeAdtRequestWithSession(
        connection,
        sessionId,
        'POST',
        url,
        xmlBody,
        headers
    );
}

/**
 * Check behavior definition implementation
 * 
 * Uses bdefImplementationCheck reporter
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @returns Axios response with check results
 * 
 * @example
 * ```typescript
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export async function checkImplementation(
    connection: AbapConnection,
    name: string,
    sessionId: string,
    version: string = 'inactive'
): Promise<AxiosResponse> {
    return check(connection, name, 'bdefImplementationCheck', sessionId, version);
}

/**
 * Check behavior definition ABAP syntax
 * 
 * Uses abapCheckRun reporter
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @returns Axios response with check results
 * 
 * @example
 * ```typescript
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export async function checkAbap(
    connection: AbapConnection,
    name: string,
    sessionId: string,
    version: string = 'inactive'
): Promise<AxiosResponse> {
    return check(connection, name, 'abapCheckRun', sessionId, version);
}
