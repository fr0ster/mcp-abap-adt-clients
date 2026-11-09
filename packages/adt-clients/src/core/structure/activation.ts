/**
 * Structure activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
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
  headers: IAdtHeaders,
  structureName: string,
  preauditRequested: boolean,
): Promise<IAdtWireResponse> {
  const objectUri = `${STRUCTURE.uri(structureName)}`;
  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    structureName,
    preauditRequested,
  );
}
