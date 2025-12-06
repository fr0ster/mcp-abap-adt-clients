/**
 * Class include files operations (local types, definitions, macros)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Update class local types include (implementations)
 * 
 * Local helper classes, interface definitions and type declarations.
 * Requires the class to be locked (lock handle) before calling.
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param localTypesSource - Local types source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export async function updateClassLocalTypes(
  connection: IAbapConnection,
  className: string,
  localTypesSource: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  return updateClassInclude(
    connection,
    className,
    localTypesSource,
    'implementations',
    lockHandle,
    transportRequest
  );
}

/**
 * Update class-relevant local types include (definitions)
 * 
 * Type declarations needed for components in the private section.
 * Requires the class to be locked (lock handle) before calling.
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param definitionsSource - Definitions source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export async function updateClassDefinitions(
  connection: IAbapConnection,
  className: string,
  definitionsSource: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  return updateClassInclude(
    connection,
    className,
    definitionsSource,
    'definitions',
    lockHandle,
    transportRequest
  );
}

/**
 * Update class macros include
 * 
 * Macro definitions needed in the implementation part of the class.
 * Note: Macros are supported in older ABAP versions but not in newer ones.
 * Requires the class to be locked (lock handle) before calling.
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param macrosSource - Macros source code
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
export async function updateClassMacros(
  connection: IAbapConnection,
  className: string,
  macrosSource: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  return updateClassInclude(
    connection,
    className,
    macrosSource,
    'macros',
    lockHandle,
    transportRequest
  );
}

/**
 * Generic function to update any class include file
 * 
 * @param connection - SAP connection
 * @param className - Class name
 * @param includeSource - Include source code
 * @param includeType - Type of include (implementations, definitions, macros)
 * @param lockHandle - Lock handle from lock operation
 * @param transportRequest - Optional transport request
 * @returns Update result
 */
async function updateClassInclude(
  connection: IAbapConnection,
  className: string,
  includeSource: string,
  includeType: 'implementations' | 'definitions' | 'macros',
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  if (!includeSource) {
    throw new Error(`${includeType} source code is required`);
  }

  if (!lockHandle) {
    throw new Error(`lockHandle is required to update ${includeType}`);
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/${includeType}?lockHandle=${lockHandle}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    Accept: 'text/plain'
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: includeSource,
    headers
  });
}
