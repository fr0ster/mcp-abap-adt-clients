/**
 * Program read operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP program metadata (without source code)
 */
export async function getProgramMetadata(
  connection: AbapConnection,
  programName: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'program', programName);
}

/**
 * Get ABAP program source code
 */
export async function getProgramSource(
  connection: AbapConnection,
  programName: string
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'program', programName);
}

/**
 * Get ABAP program (source code by default for backward compatibility)
 * @deprecated Use getProgramSource() or getProgramMetadata() instead
 */
export async function getProgram(
  connection: AbapConnection,
  programName: string
): Promise<AxiosResponse> {
  return getProgramSource(connection, programName);
}

