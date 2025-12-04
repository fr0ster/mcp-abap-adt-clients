/**
 * Table activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the table after creation
 */
export async function activateTable(
  connection: IAbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}`;
  return await activateObjectInSession(connection, objectUri, tableName, true);
}

