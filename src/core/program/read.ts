/**
 * Program read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP program metadata (without source code)
 */
export async function getProgramMetadata(
  connection: IAbapConnection,
  programName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return readObjectMetadata(
    connection,
    'program',
    programName,
    undefined,
    options,
  );
}

/**
 * Get ABAP program source code
 */
export async function getProgramSource(
  connection: IAbapConnection,
  programName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return readObjectSource(
    connection,
    'program',
    programName,
    undefined,
    version,
    options,
  );
}

/**
 * Get ABAP program (source code by default for backward compatibility)
 * @deprecated Use getProgramSource() or getProgramMetadata() instead
 */
export async function getProgram(
  connection: IAbapConnection,
  programName: string,
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
  connection: IAbapConnection,
  programName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(programName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/programs/programs/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
