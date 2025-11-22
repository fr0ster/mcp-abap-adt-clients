/**
 * Activate Metadata Extension (DDLX)
 * 
 * Endpoint: POST /sap/bc/adt/activation?method=activate&preauditRequested=true
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate a metadata extension
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sessionId - Session ID for request tracking
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 * 
 * @example
 * ```typescript
 * await activateMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', sessionId);
 * ```
 */
export async function activateMetadataExtension(
  connection: AbapConnection,
  name: string,
  preaudit: boolean = true
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const objectUri = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;

  return activateObjectInSession(
    connection,
    objectUri,
    name.toUpperCase(),
    preaudit
  );
}
