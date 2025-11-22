/**
 * Program read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
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

/**
 * Get transport request for ABAP program
 * @param connection - SAP connection
 * @param programName - Program name
 * @returns Transport request information
 */
export async function getProgramTransport(
  connection: AbapConnection,
  programName: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(programName);
  const url = `/sap/bc/adt/programs/programs/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
  });
}

