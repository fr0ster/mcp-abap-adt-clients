/**
 * Search operations for ABAP objects
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { SearchObjectsParams } from './types';

/**
 * Search for ABAP objects by name pattern
 *
 * @param connection - ABAP connection
 * @param params - Search parameters
 * @returns Search results
 */
export async function searchObjects(
  connection: AbapConnection,
  params: SearchObjectsParams
): Promise<AxiosResponse> {
  const encodedQuery = encodeSapObjectName(params.query);
  const maxResults = params.maxResults || 100;

  let url = `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=${encodedQuery}&maxResults=${maxResults}`;

  if (params.objectType) {
    url += `&objectType=${encodeSapObjectName(params.objectType)}`;
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

