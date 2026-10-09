/**
 * Class activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

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
  const objectUri = `${CLASS.uri(className)}`;
  return await activateObjectInSession(connection, objectUri, className, true);
}
