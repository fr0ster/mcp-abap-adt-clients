/**
 * Class read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
export async function getClassMetadata(
  connection: AbapConnection,
  className: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'class', className);
}

/**
 * Get ABAP class source code
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassSource(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'class', className, undefined, version);
}

/**
 * Get ABAP class (source code by default for backward compatibility)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @deprecated Use getClassSource() or getClassMetadata() instead
 */
export async function getClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return getClassSource(connection, className, version);
}

