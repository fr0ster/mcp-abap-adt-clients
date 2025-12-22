/**
 * Structure activation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate the structure after creation
 */
export async function activateStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    structureName,
    true,
  );
}
