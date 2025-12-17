/**
 * TableType read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP table type metadata (without source code)
 */
export async function getTableTypeMetadata(
  connection: IAbapConnection,
  tableTypeName: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.tabletypes.v2+xml, application/vnd.sap.adt.tabletypes.v1+xml, application/vnd.sap.adt.blues.v1+xml'
    }
  });
}

/**
 * Get ABAP table type source code (DDL)
 */
export async function getTableTypeSource(
  connection: IAbapConnection,
  tableTypeName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const versionParam = version === 'inactive' ? 'version=inactive' : '';
  const longPollingParam = options?.withLongPolling ? 'withLongPolling=true' : '';

  const queryParams = [versionParam, longPollingParam].filter(Boolean).join('&');
  const query = queryParams ? `?${queryParams}` : '';

  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain'
    }
  });
}

/**
 * Get ABAP table type (source code by default for backward compatibility)
 * @deprecated Use getTableTypeSource() or getTableTypeMetadata() instead
 */
export async function getTableType(
  connection: IAbapConnection,
  tableTypeName: string
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
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableTypeName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}
