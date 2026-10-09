/**
 * Search operations for ABAP objects
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ISearchObjectsParams } from './types';

/**
 * Search for ABAP objects by name pattern
 *
 * @param connection - ABAP connection
 * @param params - Search parameters
 * @returns The quickSearch document, as it came. `utilSearchHits` in
 *   `@mcp-abap-adt/adt-strategies` reads it into hits.
 */
export async function searchObjects(
  connection: IAbapConnection,
  params: ISearchObjectsParams,
): Promise<IAdtWireResponse> {
  const encodedQuery = encodeSapObjectName(params.query as string);
  const maxResults = params.maxResults || 100;

  let url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}&maxResults=${maxResults}`;

  if (params.objectType) {
    url += `&objectType=${encodeSapObjectName(params.objectType as string)}`;
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
