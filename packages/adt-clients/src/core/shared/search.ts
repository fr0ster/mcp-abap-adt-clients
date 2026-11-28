/**
 * Search operations for ABAP objects
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import type { ISearchObjectsParams } from './types';

/**
 * Search for ABAP objects by name pattern
 *
 * **No result bound of the library's.** `maxResults` goes out exactly as
 * given, `0` included; without one the URL carries none and SAP's own bound
 * applies (mcp-abap-adt#391). Measured on the BTP ABAP environment
 * (2026-11-27): without `maxResults` the quick search answered 200 hits of
 * 8886, `maxResults=0` answered 200 as well, and `maxResults=100000`
 * answered all 8886. Until 48.0.0 a missing or `0` bound was sent as 100.
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
  const encodedQuery = encodeSapObjectName(params.query);
  let url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}`;
  if (params.maxResults !== undefined) {
    url += `&maxResults=${params.maxResults}`;
  }

  if (params.objectType) {
    url += `&objectType=${encodeSapObjectName(params.objectType)}`;
  }

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: 'application/xml',
    },
  });
}
