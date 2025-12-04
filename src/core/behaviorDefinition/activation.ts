/**
 * Behavior Definition activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate behavior definition
 * 
 * Makes behavior definition active and usable in SAP system
 * 
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param preauditRequested - Request preaudit (default: true)
 * @returns Axios response with activation result
 * 
 * @example
 * ```typescript
 * await activate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export async function activate(
    connection: IAbapConnection,
    name: string,
    preauditRequested: boolean = true
): Promise<AxiosResponse> {
    const objectUri = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}`;
    return await activateObjectInSession(
        connection,
        objectUri,
        name.toUpperCase(),
        preauditRequested
    );
}
