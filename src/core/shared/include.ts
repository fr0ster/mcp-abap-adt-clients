/**
 * Include operations for ABAP objects
 *
 * Retrieves source code of specific ABAP include files.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE } from '../../constants/contentTypes';
import { PROGRAM_INCLUDE, sourceUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

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
  includeName: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(PROGRAM_INCLUDE.uri(includeName))}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_SOURCE,
    },
  });
}
