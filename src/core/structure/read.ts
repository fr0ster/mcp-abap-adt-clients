/**
 * Structure read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { noopLogger } from '../../utils/noopLogger';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from '../shared/AdtUtils';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get ABAP structure metadata (without source code)
 */
export async function getStructureMetadata(
  connection: IAbapConnection,
  structureName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectMetadata(
    'structure',
    structureName,
    undefined,
    options,
  );
}

/**
 * Get ABAP structure source code
 */
export async function getStructureSource(
  connection: IAbapConnection,
  structureName: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectSource(
    'structure',
    structureName,
    undefined,
    version,
    options,
  );
}

/**
 * Get ABAP structure (source code by default for backward compatibility)
 * @deprecated Use getStructureSource() or getStructureMetadata() instead
 */
export async function getStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<AxiosResponse> {
  return getStructureSource(connection, structureName);
}

/**
 * Get transport request for ABAP structure
 * @param connection - SAP connection
 * @param structureName - Structure name
 * @returns Transport request information
 */
export async function getStructureTransport(
  connection: IAbapConnection,
  structureName: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(structureName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/structures/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
    },
  });
}
