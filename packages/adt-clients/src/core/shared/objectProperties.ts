/**
 * Object properties from the repository information system
 *
 * The properties of any repository object, named by its ADT uri.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * What the endpoint answers, measured on premise (SAP_BASIS 816, 2026-10-21).
 */
export const OBJECT_PROPERTIES_ACCEPT =
  'application/vnd.sap.adt.repository.objproperties.result.v1+xml';

/**
 * Get the properties of one repository object
 *
 * Endpoint: GET /sap/bc/adt/repository/informationsystem/objectproperties/values?uri={objectUri}
 *
 * @param connection - ABAP connection instance
 * @param objectUri - The object's ADT uri, e.g.
 *   `/sap/bc/adt/vit/wb/object_type/trant/object_name/SE38` for a transaction;
 *   sent URL-encoded
 * @returns The `opr:objectProperties` document: the object (name, type, text,
 *   package) and its properties per facet
 */
export async function getObjectProperties(
  connection: IAbapConnection,
  objectUri: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(objectUri)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: OBJECT_PROPERTIES_ACCEPT,
    },
  });
}
