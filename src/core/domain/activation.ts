/**
 * Domain activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DOMAIN } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate domain
 * Makes domain active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function activateDomain(
  connection: IAbapConnection,
  domainName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${DOMAIN.uri(domainName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    domainName.toUpperCase(),
    true,
  );
}
