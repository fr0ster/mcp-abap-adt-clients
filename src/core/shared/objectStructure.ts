/**
 * Object structure operations for ABAP objects
 *
 * Retrieves ADT object structure as compact JSON tree.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get object structure from ADT repository
 *
 * Endpoint: GET /sap/bc/adt/repository/objectstructure?objecttype={type}&objectname={name}
 *
 * @param connection - ABAP connection instance
 * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
 * @param objectName - Object name
 * @returns Axios response with XML containing object structure tree
 *
 * @example
 * ```typescript
 * const response = await getObjectStructure(connection, 'CLAS/OC', 'ZMY_CLASS');
 * // Response contains XML with object structure
 * ```
 */
export async function getObjectStructure(
  connection: IAbapConnection,
  objectType: string,
  objectName: string,
): Promise<AxiosResponse> {
  if (!objectType) {
    throw new Error('Object type is required');
  }
  if (!objectName) {
    throw new Error('Object name is required');
  }

  const encodedType = encodeURIComponent(objectType);
  const encodedName = encodeURIComponent(encodeSapObjectName(objectName));
  const url = `/sap/bc/adt/repository/objectstructure?objecttype=${encodedType}&objectname=${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        'application/vnd.sap.adt.projectexplorer.objectstructure+xml, application/xml',
    },
  });
}
