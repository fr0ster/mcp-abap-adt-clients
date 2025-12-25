/**
 * Core read operations - private implementations
 * All read-only methods are implemented here once and reused by clients
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../utils/internalUtils';
import { getTimeout } from './timeouts';

/**
 * Internal helper to make ADT request
 */
async function makeAdtRequest(
  connection: IAbapConnection,
  url: string,
  method: string = 'GET',
  timeout: 'default' | 'csrf' | 'long' | number = 'default',
  data?: any,
  params?: any,
  headers?: Record<string, string>,
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

/**
 * Get ABAP program source code
 */
export async function getProgram(
  connection: IAbapConnection,
  programName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(programName);
  const url = `/sap/bc/adt/programs/programs/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP class source code
 */
export async function getClass(
  connection: IAbapConnection,
  className: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);
  const url = `/sap/bc/adt/oo/classes/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP table structure
 */
export async function getTable(
  connection: IAbapConnection,
  tableName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(tableName);
  const url = `/sap/bc/adt/ddic/tables/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP structure
 */
export async function getStructure(
  connection: IAbapConnection,
  structureName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(structureName);
  const url = `/sap/bc/adt/ddic/structures/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP domain
 */
export async function getDomain(
  connection: IAbapConnection,
  domainName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(domainName);
  const url = `/sap/bc/adt/ddic/domains/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP data element
 */
export async function getDataElement(
  connection: IAbapConnection,
  dataElementName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(dataElementName);
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP interface
 */
export async function getInterface(
  connection: IAbapConnection,
  interfaceName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(interfaceName);
  const url = `/sap/bc/adt/oo/interfaces/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP function group
 */
export async function getFunctionGroup(
  connection: IAbapConnection,
  functionGroupName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(functionGroupName);
  const url = `/sap/bc/adt/functions/groups/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP function module
 */
export async function getFunction(
  connection: IAbapConnection,
  functionName: string,
  functionGroup: string,
): Promise<AxiosResponse> {
  const encodedGroup = encodeSapObjectName(functionGroup);
  const encodedName = encodeSapObjectName(functionName);
  const url = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP package
 */
export async function getPackage(
  connection: IAbapConnection,
  packageName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(packageName);
  const url = `/sap/bc/adt/packages/${encodedName}`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Get ABAP view (CDS or Classic)
 */
export async function getView(
  connection: IAbapConnection,
  viewName: string,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(viewName);
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
  return makeAdtRequest(connection, url, 'GET', 'default');
}

/**
 * Fetches node structure from SAP ADT repository
 */
export async function fetchNodeStructure(
  connection: IAbapConnection,
  parentName: string,
  parentTechName: string,
  parentType: string,
  nodeKey: string,
  withShortDescriptions: boolean = true,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/repository/nodestructure`;

  const params = {
    parent_name: parentName,
    parent_tech_name: parentTechName,
    parent_type: parentType,
    withShortDescriptions: withShortDescriptions.toString(),
  };

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
<asx:values>
<DATA>
<TV_NODEKEY>${nodeKey}</TV_NODEKEY>
</DATA>
</asx:values>
</asx:abap>`;

  return makeAdtRequest(connection, url, 'POST', 'default', xmlBody, params, {
    Accept:
      'application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
  });
}

/**
 * Get system information from SAP ADT (for cloud systems)
 * Returns systemID and userName if available
 */
export async function getSystemInformation(
  connection: IAbapConnection,
): Promise<{ systemID?: string; userName?: string } | null> {
  try {
    const url = `/sap/bc/adt/core/http/systeminformation`;

    const headers = {
      Accept: 'application/json',
    };

    const response = await makeAdtRequest(
      connection,
      url,
      'GET',
      'default',
      undefined,
      undefined,
      headers,
    );

    if (response.data && typeof response.data === 'object') {
      return {
        systemID: response.data.systemID,
        userName: response.data.userName,
      };
    }

    return null;
  } catch (_error) {
    // If endpoint doesn't exist (on-premise), return null
    return null;
  }
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
