import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
/**
 * Behavior Implementation read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { CLASS_INCLUDE } from '../../endpoints/objects';
import { objectMetadataWire, objectSourceWire } from '../shared/objectWire';
import { readQuery } from '../shared/readQuery';
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
    'CLAS/OC',
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
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  return objectSourceWire(
    connection,
    'CLAS/OC',
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
  version?: AdtReadVersion,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  // The version the caller names, as named; none without one.
  const url = `${CLASS_INCLUDE.uri(className, 'implementations')}${readQuery(version, options?.withLongPolling)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: options?.accept ?? ACCEPT_SOURCE,
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
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  // Behavior implementation is a class, so use class transport endpoint
  const { getClassTransport } = await import('../class/read');
  return getClassTransport(connection, className, options);
}
