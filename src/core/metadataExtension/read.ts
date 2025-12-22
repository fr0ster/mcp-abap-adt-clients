/**
 * Read Metadata Extension (DDLX)
 *
 * Endpoint: GET /sap/bc/adt/ddic/ddlx/sources/{name}
 * Source: GET /sap/bc/adt/ddic/ddlx/sources/{name}/source/main
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Read metadata extension metadata
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @returns Axios response with metadata extension metadata
 *
 * @example
 * ```typescript
 * const metadata = await readMetadataExtension(connection, 'ZOK_C_CDS_TEST_0001');
 * ```
 */
export async function readMetadataExtension(
  connection: IAbapConnection,
  name: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}${query}`;

  const headers = {
    Accept: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });
}

/**
 * Read metadata extension source code
 *
 * @param connection - ABAP connection instance
 * @param name - Metadata extension name (e.g., 'ZOK_C_CDS_TEST_0001')
 * @param version - Version to read ('active' or 'inactive', default 'active')
 * @returns Axios response with source code as string
 *
 * @example
 * ```typescript
 * const response = await readMetadataExtensionSource(connection, 'ZOK_C_CDS_TEST_0001');
 * const sourceCode = response.data;
 * ```
 */
export async function readMetadataExtensionSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const versionQuery = version === 'inactive' ? '?version=inactive' : '';
  const longPollingQuery = options?.withLongPolling
    ? versionQuery
      ? '&withLongPolling=true'
      : '?withLongPolling=true'
    : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/source/main${versionQuery}${longPollingQuery}`;

  const headers = {
    Accept: 'text/plain',
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });
}

/**
 * Get transport request for ABAP metadata extension
 * @param connection - SAP connection
 * @param name - Metadata extension name
 * @returns Transport request information
 */
export async function getMetadataExtensionTransport(
  connection: IAbapConnection,
  name: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const lowerName = name.toLowerCase();
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddlx/sources/${lowerName}/transport${query}`;

  const headers = {
    Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });
}
