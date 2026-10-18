/**
 * Delete Metadata Extension (DDLX)
 *
 * Endpoint: DELETE /sap/bc/adt/ddic/ddlx/sources/{name}
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { METADATA_EXTENSION } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Delete a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZDEMO_C_CDS_MDE')
 * @param transportRequest - Transport request number (optional for local objects)
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 *
 * @example
 * ```typescript
 * await deleteMetadataExtension(connection, 'ZDEMO_C_CDS_MDE', 'DEVK900123', sessionId);
 * ```
 */
export async function deleteMetadataExtension(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  transportRequest: string | undefined,
): Promise<IAdtWireResponse> {
  const url = `${METADATA_EXTENSION.uri(name)}${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  return connection.makeAdtRequest({
    method: 'DELETE',
    url,
    timeout: 0,
    data: undefined,
    headers: requestHeaders(headers),
  });
}
