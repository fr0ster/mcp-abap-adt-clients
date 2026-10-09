/**
 * Structure activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the structure after creation
 */
export async function activateStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${STRUCTURE.uri(structureName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    structureName,
    true,
  );
}
