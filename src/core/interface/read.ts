/**
 * Interface read operations
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
 * Get ABAP interface metadata (without source code)
 */
export async function getInterfaceMetadata(
  connection: IAbapConnection,
  interfaceName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectMetadata(
    'interface',
    interfaceName,
    undefined,
    options,
  );
}

/**
 * Get ABAP interface source code
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getInterfaceSource(
  connection: IAbapConnection,
  interfaceName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectSource(
    'interface',
    interfaceName,
    undefined,
    version,
    options,
  );
}

/**
 * Get ABAP interface (source code by default for backward compatibility)
 * @deprecated Use getInterfaceSource() or getInterfaceMetadata() instead
 */
export async function getInterface(
  connection: IAbapConnection,
  interfaceName: string,
): Promise<AxiosResponse> {
  return getInterfaceSource(connection, interfaceName);
}

/**
 * Get transport request for ABAP interface
 * @param connection - SAP connection
 * @param interfaceName - Interface name
 * @returns Transport request information
 */
export async function getInterfaceTransport(
  connection: IAbapConnection,
  interfaceName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(interfaceName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/oo/interfaces/${encodedName}/transport${query}`;

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
