/**
 * Structure activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the structure after creation
 */
export async function activateStructure(
  connection: IAbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}`;
  return await activateObjectInSession(connection, objectUri, structureName, true);
}

