/**
 * Class read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readObjectMetadata } from '../shared/readMetadata';
import { readObjectSource } from '../shared/readSource';

/**
 * Get ABAP class metadata (without source code)
 * @param connection - SAP connection
 * @param className - Class name
 */
export async function getClassMetadata(
  connection: IAbapConnection,
  className: string
): Promise<AxiosResponse> {
  return readObjectMetadata(connection, 'class', className);
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  return readObjectSource(connection, 'class', className, undefined, version);
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
  version: 'active' | 'inactive' = 'active'
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
  className: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const url = `/sap/bc/adt/oo/classes/${encodedName}/transport`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.adt.transportorganizer.v1+xml'
    }
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/definitions?version=${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain; charset=utf-8'
    }
  });
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/macros?version=${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain; charset=utf-8'
    }
  });
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?version=${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain; charset=utf-8'
    }
  });
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
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?version=${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain; charset=utf-8'
    }
  });
}

