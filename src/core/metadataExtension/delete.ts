/**
 * Delete Metadata Extension (DDLX)
 *
 * Endpoint: DELETE /sap/bc/adt/ddic/ddlx/sources/{name}
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Delete a metadata extension
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param transportRequest - Transport request number (optional for local objects)
 * @param sessionId - Session ID for request tracking
 * @returns Axios response
 *
 * @example
 * ```typescript
 * await deleteMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', 'TRLK900123', sessionId);
 * ```
 */
export async function deleteMetadataExtension(
  connection: IAbapConnection,
  name: string,
  transportRequest: string | undefined,
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}${transportRequest ? `?corrNr=${transportRequest}` : ''}`;

  const headers = {
    Accept: 'application/xml',
  };

  return connection.makeAdtRequest({
    method: 'DELETE',
    url,
    timeout: getTimeout('default'),
    data: undefined,
    headers,
  });
}
