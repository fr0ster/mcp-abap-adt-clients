/**
 * Enhancement operations for ABAP objects
 * 
 * Retrieves enhancement implementations for programs, includes, and classes.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get enhancement implementations for ABAP object
 * 
 * Supports three object types:
 * - Classes: `/sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements`
 * - Programs: `/sap/bc/adt/programs/programs/{name}/source/main/enhancements/elements`
 * - Includes: `/sap/bc/adt/programs/includes/{name}/source/main/enhancements/elements?context={program}`
 * 
 * @param connection - ABAP connection instance
 * @param objectName - Object name (program, include, or class)
 * @param objectType - Object type: 'program' | 'include' | 'class'
 * @param context - Optional program context for includes (required when objectType is 'include')
 * @returns Axios response with XML containing enhancement implementations
 * 
 * @example
 * ```typescript
 * // For a program
 * const response = await getEnhancements(connection, 'ZMY_PROGRAM', 'program');
 * 
 * // For an include
 * const response = await getEnhancements(connection, 'ZMY_INCLUDE', 'include', 'ZMY_PROGRAM');
 * 
 * // For a class
 * const response = await getEnhancements(connection, 'ZMY_CLASS', 'class');
 * ```
 */
export async function getEnhancements(
  connection: IAbapConnection,
  objectName: string,
  objectType: 'program' | 'include' | 'class',
  context?: string
): Promise<AxiosResponse> {
  if (!objectName) {
    throw new Error('Object name is required');
  }

  const encodedName = encodeSapObjectName(objectName.toLowerCase());
  let url: string;

  switch (objectType) {
    case 'class':
      url = `/sap/bc/adt/oo/classes/${encodedName}/source/main/enhancements/elements`;
      break;
    case 'program':
      url = `/sap/bc/adt/programs/programs/${encodedName}/source/main/enhancements/elements`;
      break;
    case 'include':
      if (!context) {
        throw new Error('Program context is required for includes');
      }
      const encodedContext = encodeURIComponent(context);
      url = `/sap/bc/adt/programs/includes/${encodedName}/source/main/enhancements/elements?context=${encodedContext}`;
      break;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

