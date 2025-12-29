/**
 * Program read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { noopLogger } from '../../utils/noopLogger';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from '../shared/AdtUtils';
import type { IReadOptions } from '../shared/types';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get ABAP program metadata (without source code)
 */
export async function getProgramMetadata(
  connection: IAbapConnection,
  programName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectMetadata(
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
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectSource(
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
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(programName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/programs/programs/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        options?.accept ?? 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
