/**
 * TableType activation operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate the table type after creation
 */
export async function activateTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<IAdtResponse> {
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    tableTypeName,
    true,
  );
}
