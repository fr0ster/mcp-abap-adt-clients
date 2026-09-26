/**
 * Get Inactive Objects - retrieve list of objects not yet activated
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get list of inactive objects (objects that are not yet activated)
 *
 * Endpoint: GET /sap/bc/adt/activation/inactiveobjects
 *
 * @param connection - ABAP connection instance
 * @param options - Optional parameters
 * @returns List of inactive objects with their metadata
 *
 * @example
 * ```typescript
 * const result = await getInactiveObjects(connection);
 *
 * // Objects can be directly passed to activateObjectsGroup
 * await activateObjectsGroup(connection, result.objects);
 * ```
 */
/**
 * The request, and only the request.
 *
 * Split from the reading below so the reading can be injected: this is one GET
 * with one answer, which is exactly the shape an `IResultStrategy` types. The
 * default reading keeps the document; `utilInactiveObjects` in
 * `@mcp-abap-adt/adt-strategies` reads it into references.
 */
export async function fetchInactiveObjects(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/activation/inactiveobjects`,
    timeout: getTimeout('default'),
    headers: {
      Accept:
        'application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8',
    },
  });
}
