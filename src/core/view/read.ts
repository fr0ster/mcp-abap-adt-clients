/**
 * View read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP view metadata (without source code)
 */
export async function getViewMetadata(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'view', viewName);
}

/**
 * Get ABAP view source code
 */
export async function getViewSource(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'view', viewName);
}

/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getViewSource() or getViewMetadata() instead
 */
export async function getView(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  return getViewSource(connection, viewName);
}

