/**
 * Table read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP table metadata (without source code)
 */
export async function getTableMetadata(
  connection: IAbapConnection,
  tableName: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'table', tableName, undefined, options);
}

/**
 * Get ABAP table source code (DDL)
 */
export async function getTableSource(
  connection: IAbapConnection,
  tableName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'table', tableName, undefined, version, options);
}

/**
 * Get ABAP table (source code by default for backward compatibility)
 * @deprecated Use getTableSource() or getTableMetadata() instead
 */
export async function getTable(
  connection: IAbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  return getTableSource(connection, tableName);
}

/**
 * Get transport request for ABAP table
 * @param connection - SAP connection
 * @param tableName - Table name
 * @returns Transport request information
 */
export async function getTableTransport(
  connection: IAbapConnection,
  tableName: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tables/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

