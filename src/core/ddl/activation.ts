/**
 * View activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
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
  headers: IAdtHeaders,
  ddlName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${DDL_SOURCE.uri(ddlName)}`;
  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    ddlName,
    true,
  );
}
