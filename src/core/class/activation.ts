/**
 * Class activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate class
 * Makes class active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function activateClass(
  connection: IAbapConnection,
  className: string,
): Promise<IAdtWireResponse> {
  const objectUri = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, className, true);
}
