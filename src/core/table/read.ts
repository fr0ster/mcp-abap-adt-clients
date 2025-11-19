/**
 * Table read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP table metadata (without source code)
 */
export async function getTableMetadata(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'table', tableName);
}

/**
 * Get ABAP table source code (DDL)
 */
export async function getTableSource(
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'table', tableName);
}

/**
 * Get ABAP table (source code by default for backward compatibility)
 * @deprecated Use getTableSource() or getTableMetadata() instead
 */
export async function getTable(
  connection: AbapConnection,
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
  connection: AbapConnection,
  tableName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(tableName);
  const url = `${baseUrl}/sap/bc/adt/ddic/tables/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

