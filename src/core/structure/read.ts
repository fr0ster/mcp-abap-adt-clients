/**
 * Structure read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP structure metadata (without source code)
 */
export async function getStructureMetadata(
  connection: AbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'structure', structureName);
}

/**
 * Get ABAP structure source code
 */
export async function getStructureSource(
  connection: AbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'structure', structureName);
}

/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
export async function getStructure(
  connection: AbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  return getStructureSource(connection, structureName);
}

