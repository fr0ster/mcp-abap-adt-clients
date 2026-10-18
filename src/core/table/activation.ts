/**
 * Table activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
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
  headers: IAdtHeaders,
  tableName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${TABLE.uri(tableName)}`;
  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    tableName,
    true,
  );
}
