/**
 * Include operations for ABAP objects
 * 
 * Retrieves source code of specific ABAP include files.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get include source code
 * 
 * Endpoint: GET /sap/bc/adt/programs/includes/{name}/source/main
 * 
 * @param connection - ABAP connection instance
 * @param includeName - Include name
 * @returns Axios response with source code (plain text)
 * 
 * @example
 * ```typescript
 * const response = await getInclude(connection, 'ZMY_INCLUDE');
 * const sourceCode = response.data; // Include source code
 * ```
 */
export async function getInclude(
  connection: IAbapConnection,
  includeName: string
): Promise<AxiosResponse> {
  if (!includeName) {
    throw new Error('Include name is required');
  }

  const encodedName = encodeSapObjectName(includeName.toLowerCase());
  const url = `/sap/bc/adt/programs/includes/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'text/plain'
    }
  });
}

