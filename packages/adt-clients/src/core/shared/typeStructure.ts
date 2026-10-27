/**
 * The repository's object types, as the system states them.
 *
 * `POST /sap/bc/adt/repository/typestructure`, no body: each type's code,
 * label, category, `URI_TEMPLATE`, parent type, name length and capabilities.
 * Recorded on S/4HANA 2025, ABAP cloud and SAP_BASIS 7.40 SP04 with the Accept
 * `ACCEPT_TYPE_STRUCTURE`, which each answered `200`. Its headers are the
 * caller's, as for every `getUtils` member that takes them. The conformance check of the ADT type
 * tables reads it through this member.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';

export async function getTypeStructure(
  connection: IAbapConnection,
  headers: IAdtHeaders,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: '/sap/bc/adt/repository/typestructure',
    method: 'POST',
    timeout: 0,
    headers: requestHeaders(headers),
  });
}
