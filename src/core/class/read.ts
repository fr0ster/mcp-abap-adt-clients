/**
 * Class read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { ACCEPT_SOURCE, ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { CLASS, CLASS_INCLUDE, transportUri } from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import {
  encodeSapObjectName,
  longPollingQuery,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { objectMetadataWire, objectSourceWire } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
export async function getClassMetadata(
  connection: IAbapConnection,
  className: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectMetadataWire(connection, 'class', className, undefined, options);
}

/**
 * Get ABAP class source code
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassSource(
  connection: IAbapConnection,
  className: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectSourceWire(
    connection,
    'class',
    className,
    undefined,
    version,
    options,
  );
}

/**
 * Get transport request for ABAP class
 * @param connection - SAP connection
 * @param className - Class name
 * @returns Transport request information
 */
export async function getClassTransport(
  connection: IAbapConnection,
  className: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  let url = `${transportUri(CLASS.uri(className))}`;
  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}

/**
 * Get ABAP class definitions include (local types in private section)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassDefinitionsInclude(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
  logger?: ILogger,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = longPollingQuery(
    `${CLASS_INCLUDE.uri(className, 'definitions')}?version=${versionParam}`,
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
 * Get ABAP class macros include
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassMacrosInclude(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
  logger?: ILogger,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = longPollingQuery(
    `${CLASS_INCLUDE.uri(className, 'macros')}?version=${versionParam}`,
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
 * Get ABAP class testclasses include (local test classes)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassTestClassesInclude(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
  logger?: ILogger,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = longPollingQuery(
    `${CLASS_INCLUDE.uri(className, 'testclasses')}?version=${versionParam}`,
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
 * Get ABAP class implementations include (local types, helper classes, interfaces)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClassImplementationsInclude(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
  logger?: ILogger,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = longPollingQuery(
    `${CLASS_INCLUDE.uri(className, 'implementations')}?version=${versionParam}`,
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
