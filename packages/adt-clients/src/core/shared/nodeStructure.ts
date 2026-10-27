/**
 * Node structure operations for ABAP objects
 *
 * Provides functions for fetching node structure from ADT repository.
 * Used by GetObjectInfo, GetIncludesList, and other tree navigation operations.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';

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
  headers: IAdtHeaders,
  parentType: string,
  parentName: string,
  nodeId?: string,
  withShortDescriptions: boolean = true,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/repository/nodestructure`;

  const params: Record<string, string | number | boolean> = {
    parent_type: parentType,
    parent_name: parentName,
    parent_tech_name: parentName,
    withShortDescriptions: withShortDescriptions,
  };

  if (nodeId) {
    params.node_id = nodeId;
  }

  const nodeKey = nodeId || '000000';
  const xmlBody =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">` +
    `<asx:values><DATA><TV_NODEKEY>${nodeKey}</TV_NODEKEY></DATA></asx:values>` +
    `</asx:abap>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    params,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}
