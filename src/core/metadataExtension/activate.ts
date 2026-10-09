/**
 * Activate Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { METADATA_EXTENSION } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param sessionId - Session ID for request tracking
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 *
 * @example
 * ```typescript
 * await activateMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', sessionId);
 * ```
 */
export async function activateMetadataExtension(
  connection: IAbapConnection,
  name: string,
  preaudit: boolean = true,
): Promise<IAdtWireResponse> {
  const objectUri = `${METADATA_EXTENSION.uri(name)}`;

  return activateObjectInSession(
    connection,
    objectUri,
    name.toUpperCase(),
    preaudit,
  );
}
