/**
 * Interface read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP interface metadata (without source code)
 */
export async function getInterfaceMetadata(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'interface', interfaceName);
}

/**
 * Get ABAP interface source code
 */
export async function getInterfaceSource(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'interface', interfaceName);
}

/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
export async function getInterface(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  return getInterfaceSource(connection, interfaceName);
}

