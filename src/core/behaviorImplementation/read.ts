/**
 * Behavior Implementation read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { noopLogger } from '../../utils/noopLogger';
import { AdtUtils } from '../shared/AdtUtils';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get behavior implementation class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 */
export async function getBehaviorImplementationMetadata(
  connection: IAbapConnection,
  className: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectMetadata(
    'class',
    className,
    undefined,
    options,
  );
}

/**
 * Get behavior implementation class source code (main)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getBehaviorImplementationSource(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectSource(
    'class',
    className,
    undefined,
    version,
    options,
  );
}

/**
 * Get behavior implementation class implementations include source code
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getBehaviorImplementationImplementations(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' | 'workingArea' = 'active',
): Promise<AxiosResponse> {
  const { encodeSapObjectName } = await import('../../utils/internalUtils');
  const { getTimeout } = await import('../../utils/timeouts');

  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${version !== 'active' ? `?version=${version}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'text/plain',
    },
  });
}

/**
 * Get transport request for ABAP behavior implementation class
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 * @returns Transport request information
 */
export async function getBehaviorImplementationTransport(
  connection: IAbapConnection,
  className: string,
  options?: { withLongPolling?: boolean },
): Promise<AxiosResponse> {
  // Behavior implementation is a class, so use class transport endpoint
  const { getClassTransport } = await import('../class/read');
  return getClassTransport(connection, className, options);
}
