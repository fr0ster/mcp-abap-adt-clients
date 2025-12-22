/**
 * All types operations for ABAP objects
 *
 * Retrieves all valid ADT object types from the repository.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get all valid ADT object types
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objecttypes
 *
 * @param connection - ABAP connection instance
 * @param maxItemCount - Maximum number of items to return (default: 999)
 * @param name - Name filter pattern (default: '*')
 * @param data - Data filter (default: 'usedByProvider')
 * @returns Axios response with XML containing all object types
 *
 * @example
 * ```typescript
 * const response = await getAllTypes(connection);
 * // Response contains XML with all ADT object types
 * ```
 */
export async function getAllTypes(
  connection: IAbapConnection,
  maxItemCount: number = 999,
  name: string = '*',
  data: string = 'usedByProvider',
): Promise<AxiosResponse> {
  const params = new URLSearchParams({
    maxItemCount: String(maxItemCount),
    name: name,
    data: data,
  });

  const url = `/sap/bc/adt/repository/informationsystem/objecttypes?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
