/**
 * Structure activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate the structure after creation
 */
export async function activateStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    structureName,
    true,
  );
}
