/**
 * Table activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate the table after creation
 */
export async function activateTable(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}`;
  return await activateObjectInSession(connection, objectUri, tableName, true);
}

