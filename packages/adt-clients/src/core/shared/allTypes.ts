/**
 * All types operations for ABAP objects
 *
 * Retrieves all valid ADT object types from the repository.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * Get all valid ADT object types
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objecttypes
 *
 * @param connection - ABAP connection instance
 * @param maxItemCount - Maximum number of items to return, sent as given;
 *   none given, none is sent and SAP's own bound applies — 100 of 375 on the
 *   BTP ABAP environment (2026-11-27), `0` the same (mcp-abap-adt#391).
 *   Until 48.0.0 a missing one was sent as 999.
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
  maxItemCount: number | undefined,
  name: string = '*',
  data: string = 'usedByProvider',
): Promise<IAdtWireResponse> {
  const params = new URLSearchParams();
  if (maxItemCount !== undefined) {
    params.set('maxItemCount', String(maxItemCount));
  }
  params.set('name', name);
  params.set('data', data);

  const url = `/sap/bc/adt/repository/informationsystem/objecttypes?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: 'application/xml',
    },
  });
}
