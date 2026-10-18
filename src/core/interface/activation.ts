/**
 * Interface activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { INTERFACE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate interface
 * Makes interface active and usable in SAP system
 */
export async function activateInterface(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  interfaceName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${INTERFACE.uri(interfaceName)}`;
  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    interfaceName,
    true,
  );
}
