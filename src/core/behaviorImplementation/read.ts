/**
 * Behavior Implementation read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { objectMetadataWire, objectSourceWire } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

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
): Promise<IAdtWireResponse> {
  return objectMetadataWire(
    connection,
    'class',
    className,
    undefined,
    options,
    logger,
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
  version?: 'active' | 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  return objectSourceWire(
    connection,
    'class',
    className,
    undefined,
    version,
    options,
    logger,
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
): Promise<IAdtWireResponse> {
  const { encodeSapObjectName, longPollingQuery } = await import(
    '../../utils/internalUtils'
  );
  const { getTimeout } = await import('../../utils/timeouts');

  const encodedName = encodeSapObjectName(className).toLowerCase();
  // The version query is conditional here, so the base arrives both with and
  // without a `?` — which is why appending is the helper's job, not a literal.
  const url = longPollingQuery(
    `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations${version !== 'active' ? `?version=${version}` : ''}`,
    options?.withLongPolling,
  );

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_SOURCE,
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
): Promise<IAdtWireResponse> {
  // Behavior implementation is a class, so use class transport endpoint
  const { getClassTransport } = await import('../class/read');
  return getClassTransport(connection, className, options);
}
