/**
 * TableType activation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate the table type after creation
 */
export async function activateTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    tableTypeName,
    true,
  );
}
