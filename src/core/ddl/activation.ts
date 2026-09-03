/**
 * View activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate DDLS
 */
export async function activateDDLS(
  connection: IAbapConnection,
  ddlName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(ddlName).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, ddlName, true);
}
