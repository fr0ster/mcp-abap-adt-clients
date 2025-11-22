/**
 * Read Metadata Extension (DDLX)
 * 
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Read metadata extension metadata
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with metadata extension metadata
 * 
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001', sessionId);
 * ```
 */
export async function readMetadataExtension(
  connection: AbapConnection,
  name: string,
  sessionId: string
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.ddic.ddlx.v1+xml'
  };

  return makeAdtRequestWithSession(
    connection,
    sessionId,
    'GET',
    url,
    undefined,
    headers
  );
}

/**
 * Read metadata extension source code
 * 
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param sessionId - Session ID for request tracking
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 * 
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZOK_C_CDS_TEST_0001', sessionId);
 * const sourceCode = response.data;
 * ```
 */
export async function readMetadataExtensionSource(
  connection: AbapConnection,
  name: string,
  sessionId: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main${version === 'inactive' ? '?version=inactive' : ''}`;

  const headers = {
    'Accept': 'text/plain'
  };

  return makeAdtRequestWithSession(
    connection,
    sessionId,
    'GET',
    url,
    undefined,
    headers
  );
}
