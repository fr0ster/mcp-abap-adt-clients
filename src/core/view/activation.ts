/**
 * View activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate DDLS
 */
export async function activateDDLS(
  connection: IAbapConnection,
  viewName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, viewName, true);
}

