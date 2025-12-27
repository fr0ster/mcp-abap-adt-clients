/**
 * Behavior Implementation read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { noopLogger } from '../../utils/noopLogger';
import { AdtUtils } from '../shared/AdtUtils';
import type { IReadOptions } from '../shared/types';

function getUtils(connection: IAbapConnection, logger?: ILogger): AdtUtils {
  return new AdtUtils(connection, logger ?? noopLogger);
}

/**
 * Get behavior implementation class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Behavior implementation class name
 */
export async function getBehaviorImplementationMetadata(
  connection: IAbapConnection,
  className: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  return getUtils(connection, logger).readObjectMetadata(
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
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  return getUtils(connection, logger).readObjectSource(
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
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const { encodeSapObjectName } = await import('../../utils/internalUtils');
  const { getTimeout } = await import('../../utils/timeouts');

  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${version !== 'active' ? `?version=${version}` : ''}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? 'text/plain',
      },
    },
    { logger },
  );
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
  options?: IReadOptions,
): Promise<AxiosResponse> {
  // Behavior implementation is a class, so use class transport endpoint
  const { getClassTransport } = await import('../class/read');
  return getClassTransport(connection, className, options);
}
