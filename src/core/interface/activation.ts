/**
 * Interface activation operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate interface
 * Makes interface active and usable in SAP system
 */
export async function activateInterface(
  connection: IAbapConnection,
  interfaceName: string,
): Promise<IAdtResponse> {
  const objectUri = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    interfaceName,
    true,
  );
}
