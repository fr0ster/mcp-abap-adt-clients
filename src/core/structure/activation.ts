/**
 * Structure activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the structure after creation
 */
export async function activateStructure(
  connection: AbapConnection,
  structureName: string,
  sessionId: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}`;
  return await activateObjectInSession(connection, objectUri, structureName, sessionId, true);
}

