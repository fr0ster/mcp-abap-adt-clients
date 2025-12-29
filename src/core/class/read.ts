/**
 * Class read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { noopLogger } from '../../utils/noopLogger';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from '../shared/AdtUtils';
import type { IReadOptions } from '../shared/types';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
export async function getClassMetadata(
  connection: IAbapConnection,
  className: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  return getUtils(connection).readObjectMetadata(
    'class',
    className,
    undefined,
    options,
  );
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
 * Get ABAP class (source code by default for backward compatibility)
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 * @deprecated Use getClassSource() or getClassMetadata() instead
 */
export async function getClass(
  connection: IAbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  return getClassSource(connection, className, version);
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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  let url = `/sap/bc/adt/oo/classes/${encodedName}/transport`;
  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }

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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/definitions?version=${versionParam}`;

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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/macros?version=${versionParam}`;

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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?version=${versionParam}`;

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
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?version=${versionParam}`;

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
