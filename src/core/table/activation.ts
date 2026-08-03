/**
 * Table activation operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate the table after creation
 */
export async function activateTable(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtResponse> {
  const objectUri = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}`;
  return await activateObjectInSession(connection, objectUri, tableName, true);
}
