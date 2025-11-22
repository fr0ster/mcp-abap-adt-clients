/**
 * View activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate DDLS
 */
export async function activateDDLS(
  connection: AbapConnection,
  viewName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, viewName, true);
}

