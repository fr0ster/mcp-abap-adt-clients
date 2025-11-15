/**
 * Table read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
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

