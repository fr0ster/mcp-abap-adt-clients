/**
 * Node structure operations for ABAP objects
 *
 * Provides functions for fetching node structure from ADT repository.
 * Used by GetObjectInfo, GetIncludesList, and other tree navigation operations.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Fetch node structure from ADT repository
 *
 * Endpoint: POST /sap/bc/adt/repository/nodestructure
 *
 * @param connection - ABAP connection instance
 * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param parentName - Parent object name
 * @param nodeId - Optional node ID (default: '0000' for root)
 * @param withShortDescriptions - Include short descriptions (default: true)
 * @returns Axios response with XML containing node structure
 *
 * @example
 * ```typescript
 * const response = await fetchNodeStructure(connection, 'CLAS/OC', 'ZMY_CLASS', '0000');
 * // Response contains XML with node structure
 * ```
 */
export async function fetchNodeStructure(
  connection: IAbapConnection,
  parentType: string,
  parentName: string,
  nodeId?: string,
  withShortDescriptions: boolean = true,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/repository/nodestructure`;

  const params: Record<string, any> = {
    parent_type: parentType,
    parent_name: parentName,
    withShortDescriptions: withShortDescriptions,
  };

  if (nodeId) {
    params.node_id = nodeId;
  }

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}
