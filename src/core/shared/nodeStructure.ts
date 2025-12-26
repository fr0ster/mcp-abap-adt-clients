/**
 * Node structure operations for ABAP objects
 *
 * Provides functions for fetching node structure from ADT repository.
 * Used by GetObjectInfo, GetIncludesList, and other tree navigation operations.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
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
    timeout: getTimeout('default'),
    params,
    data: xmlBody,
    headers: {
      Accept:
        'application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
      'Content-Type': 'application/vnd.sap.as+xml; charset=UTF-8; dataname=null',
    },
  });
}
