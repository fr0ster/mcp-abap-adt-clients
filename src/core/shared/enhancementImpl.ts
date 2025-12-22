/**
 * Enhancement implementation operations
 *
 * Retrieves source code of specific enhancement implementations.
 * Uses different URL format: /sap/bc/adt/enhancements/{spot}/{name}/source/main
 * where spot is the enhancement spot name (not type).
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get enhancement implementation source code
 *
 * Endpoint: GET /sap/bc/adt/enhancements/{spot}/{name}/source/main
 *
 * Note: This uses spot name in URL instead of enhancement type.
 * Different from standard enhancement operations which use type in URL.
 *
 * @param connection - ABAP connection instance
 * @param enhancementSpot - Enhancement spot name (e.g., 'enhoxhh')
 * @param enhancementName - Enhancement implementation name
 * @returns Axios response with XML containing enhancement source code
 *
 * @example
 * ```typescript
 * const response = await getEnhancementImpl(connection, 'enhoxhh', 'zpartner_update_pai');
 * // Response contains XML with enhancement source code
 * ```
 */
export async function getEnhancementImpl(
  connection: IAbapConnection,
  enhancementSpot: string,
  enhancementName: string,
): Promise<AxiosResponse> {
  if (!enhancementSpot) {
    throw new Error('Enhancement spot is required');
  }
  if (!enhancementName) {
    throw new Error('Enhancement name is required');
  }

  const encodedSpot = encodeSapObjectName(enhancementSpot.toLowerCase());
  const encodedName = encodeSapObjectName(enhancementName.toLowerCase());
  const url = `/sap/bc/adt/enhancements/${encodedSpot}/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml, text/plain',
    },
  });
}
