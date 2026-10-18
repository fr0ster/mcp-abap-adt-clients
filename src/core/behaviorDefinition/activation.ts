/**
 * Behavior Definition activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { BEHAVIOR_DEFINITION } from '../../endpoints/objects';
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
  headers: IAdtHeaders,
  name: string,
  preauditRequested: boolean = true,
): Promise<IAdtWireResponse> {
  const objectUri = `${BEHAVIOR_DEFINITION.uri(name)}`;
  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    name.toUpperCase(),
    preauditRequested,
  );
}
