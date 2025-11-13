/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../utils/internalUtils';
import { getTimeout } from '@mcp-abap-adt/connection';

/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(
  connection: AbapConnection,
  url: string,
  method: string = 'GET',
  timeout: 'default' | 'csrf' | 'long' | number = 'default',
  data?: any,
  params?: any,
  headers?: Record<string, string>
): Promise<AxiosResponse> {
  const timeoutValue = getTimeout(timeout);
  return connection.makeAdtRequest({
    url,
    method,
    timeout: timeoutValue,
    data,
    params,
    headers,
  });
}

/**
 * Get base URL from connection
 */
async function getBaseUrl(connection: AbapConnection): Promise<string> {
  return connection.getBaseUrl();
}

/**
 * Get ABAP program source code
 */
export async function getProgram(connection: AbapConnection, programName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(programName);
  const url = `${baseUrl}/sap/bc/adt/programs/programs/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP class source code
 */
export async function getClass(connection: AbapConnection, className: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(className);
  const url = `${baseUrl}/sap/bc/adt/oo/classes/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP table structure
 */
export async function getTable(connection: AbapConnection, tableName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(tableName);
  const url = `${baseUrl}/sap/bc/adt/ddic/tables/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP structure
 */
export async function getStructure(connection: AbapConnection, structureName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(structureName);
  const url = `${baseUrl}/sap/bc/adt/ddic/structures/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP domain
 */
export async function getDomain(connection: AbapConnection, domainName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(domainName);
  const url = `${baseUrl}/sap/bc/adt/ddic/domains/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP data element
 */
export async function getDataElement(connection: AbapConnection, dataElementName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(dataElementName);
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP interface
 */
export async function getInterface(connection: AbapConnection, interfaceName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(interfaceName);
  const url = `${baseUrl}/sap/bc/adt/oo/interfaces/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(connection: AbapConnection, functionGroupName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(functionGroupName);
  const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP function module
 */
export async function getFunction(
  connection: AbapConnection,
  functionName: string,
  functionGroup: string
): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const url = `${baseUrl}/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP package
 */
export async function getPackage(connection: AbapConnection, packageName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(packageName);
  const url = `${baseUrl}/sap/bc/adt/packages/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP view (CDS or Classic)
 */
export async function getView(connection: AbapConnection, viewName: string): Promise<AxiosResponse> {
  const baseUrl = await getBaseUrl(connection);
  const encodedName = encodeSapObjectName(viewName);
  const url = `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

// TODO: Add more read operations as needed
// - getInclude
// - getIncludesList
// - getTypeInfo
// - getObjectInfo
// - getObjectStructure
// - getTransaction
// - getTableContents
// - getObjectsList
// - getObjectsByType
// - getProgFullCode
// - getSqlQuery
// - getWhereUsed
// - searchObject
// - getEnhancements
// - getTransport
// etc.

