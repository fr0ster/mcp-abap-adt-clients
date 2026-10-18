/**
 * Class include files operations (local types, definitions, macros)
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CLASS_INCLUDE } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

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
  headers: IAdtHeaders,
  className: string,
  localTypesSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  return updateClassInclude(
    connection,
    headers,
    className,
    localTypesSource,
    'implementations',
    lockHandle,
    transportRequest,
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
  headers: IAdtHeaders,
  className: string,
  definitionsSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  return updateClassInclude(
    connection,
    headers,
    className,
    definitionsSource,
    'definitions',
    lockHandle,
    transportRequest,
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
  headers: IAdtHeaders,
  className: string,
  macrosSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  return updateClassInclude(
    connection,
    headers,
    className,
    macrosSource,
    'macros',
    lockHandle,
    transportRequest,
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
  headers: IAdtHeaders,
  className: string,
  includeSource: string,
  includeType: 'implementations' | 'definitions' | 'macros',
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  // Empty source is legitimate: PUTting it is how an include is emptied.
  // Only a missing argument is an error.

  const url = `${CLASS_INCLUDE.uri(className, includeType)}${writeQuery(lockHandle, transportRequest)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: includeSource,
    headers: requestHeaders(headers),
  });
}
