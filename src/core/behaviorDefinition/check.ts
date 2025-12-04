/**
 * Behavior Definition check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
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
 * @param sourceCode - Optional source code to check (will be base64 encoded)
 * @returns Axios response with check results (XML)
 * 
 * @example
 * ```typescript
 * // Check saved version
 * const implResult = await check(connection, 'Z_MY_BDEF', 'bdefImplementationCheck', sessionId);
 * 
 * // Check unsaved source code
 * const syntaxResult = await check(connection, 'Z_MY_BDEF', 'abapCheckRun', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function check(
    connection: IAbapConnection,
    name: string,
    reporter: CheckReporter,
    sessionId: string,
    version: string = 'inactive',
    sourceCode?: string
): Promise<AxiosResponse> {
    let xmlBody: string;
    
    if (sourceCode) {
        // Check with source code content (for unsaved changes)
        const base64Content = Buffer.from(sourceCode, 'utf-8').toString('base64');
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}" chkrun:version="${version}">
        <chkrun:artifacts>
            <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}/source/main">
                <chkrun:content>${base64Content}</chkrun:content>
            </chkrun:artifact>
        </chkrun:artifacts>
    </chkrun:checkObject>
</chkrun:checkObjectList>`;
    } else {
        // Check saved version
        xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
    }

    const headers = {
        'Accept': 'application/vnd.sap.adt.checkmessages+xml',
        'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
    };

    const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

    return connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers
      });
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
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 * 
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId);
 * 
 * // Check unsaved changes
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function checkImplementation(
    connection: IAbapConnection,
    name: string,
    sessionId: string,
    version: string = 'inactive',
    sourceCode?: string
): Promise<AxiosResponse> {
    return check(connection, name, 'bdefImplementationCheck', sessionId, version, sourceCode);
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
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 * 
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId);
 * 
 * // Check unsaved changes
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function checkAbap(
    connection: IAbapConnection,
    name: string,
    sessionId: string,
    version: string = 'inactive',
    sourceCode?: string
): Promise<AxiosResponse> {
    return check(connection, name, 'abapCheckRun', sessionId, version, sourceCode);
}
