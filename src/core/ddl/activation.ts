/**
 * View activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DDL_SOURCE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate DDLS
 */
export async function activateDDLS(
  connection: IAbapConnection,
  ddlName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${DDL_SOURCE.uri(ddlName)}`;
  return await activateObjectInSession(connection, objectUri, ddlName, true);
}
