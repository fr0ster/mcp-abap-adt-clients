/**
 * Domain activation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate domain
 * Makes domain active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function activateDomain(
  connection: IAbapConnection,
  domainName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/domains/${encodeSapObjectName(domainName.toLowerCase())}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    domainName.toUpperCase(),
    true,
  );
}
