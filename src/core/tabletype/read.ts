/**
 * TableType read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP table type metadata (without source code)
 */
export async function getTableTypeMetadata(
  connection: IAbapConnection,
  tableTypeName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}${query}`;

  try {
    return await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: 'application/vnd.sap.adt.tabletype.v1+xml',
      },
    });
  } catch (error: any) {
    // Output full error response as-is for debugging
    const status = error.response?.status || 'unknown';
    const statusText = error.response?.statusText || '';
    const responseHeaders = JSON.stringify(
      error.response?.headers || {},
      null,
      2,
    );
    const responseData = error.response?.data
      ? typeof error.response.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response.data, null, 2)
      : error.message || 'No response data';

    const fullError = `getTableTypeMetadata failed for ${tableTypeName}
HTTP Status: ${status} ${statusText}
Response Headers: ${responseHeaders}
Response Data: ${responseData}
Request URL: ${url}
Request Headers: ${JSON.stringify({ Accept: 'application/vnd.sap.adt.tabletype.v1+xml' }, null, 2)}`;

    process.stderr.write('\n=== getTableTypeMetadata Error ===\n');
    process.stderr.write(fullError);
    process.stderr.write('\n=== End Error ===\n\n');

    console.error('\n=== getTableTypeMetadata Error ===');
    console.error(fullError);
    console.error('=== End Error ===\n');

    throw error;
  }
}

/**
 * Get ABAP table type source code (DDL)
 */
export async function getTableTypeSource(
  connection: IAbapConnection,
  tableTypeName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const versionParam = version === 'inactive' ? 'version=inactive' : '';
  const longPollingParam = options?.withLongPolling
    ? 'withLongPolling=true'
    : '';

  const queryParams = [versionParam, longPollingParam]
    .filter(Boolean)
    .join('&');
  const query = queryParams ? `?${queryParams}` : '';

  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'text/plain',
    },
  });
}

/**
 * Get ABAP table type (source code by default for backward compatibility)
 * @deprecated Use getTableTypeSource() or getTableTypeMetadata() instead
 */
export async function getTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<AxiosResponse> {
  return getTableTypeSource(connection, tableTypeName);
}

/**
 * Get transport request for ABAP table type
 * @param connection - SAP connection
 * @param tableTypeName - Table type name
 * @returns Transport request information
 */
export async function getTableTypeTransport(
  connection: IAbapConnection,
  tableTypeName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
