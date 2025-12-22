/**
 * View activation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

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
