/**
 * Table activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the table after creation
 */
export async function activateTable(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${TABLE.uri(tableName)}`;
  return await activateObjectInSession(connection, objectUri, tableName, true);
}
