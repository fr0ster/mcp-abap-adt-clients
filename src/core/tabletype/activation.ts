/**
 * TableType activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the table type after creation
 */
export async function activateTableType(
  connection: IAbapConnection,
  tableTypeName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}`;
  return await activateObjectInSession(connection, objectUri, tableTypeName, true);
}
