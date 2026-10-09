/**
 * TableType activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_TYPE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the table type after creation
 */
export async function activateTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${TABLE_TYPE.uri(tableTypeName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    tableTypeName,
    true,
  );
}
