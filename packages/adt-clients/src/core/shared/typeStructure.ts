/**
 * The repository's object types, as the system states them.
 *
 * `POST /sap/bc/adt/repository/typestructure`, no body: each type's code,
 * label, category, `URI_TEMPLATE`, parent type, name length and capabilities.
 * Recorded on S/4HANA 2025, ABAP cloud and SAP_BASIS 7.40 SP04 with the Accept
 * below, which each answered `200`. The conformance check of the ADT type
 * tables reads it through this member.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_TYPE_STRUCTURE } from '../../constants/contentTypes';

export async function getTypeStructure(
  connection: IAbapConnection,
  accept: string = ACCEPT_TYPE_STRUCTURE,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: '/sap/bc/adt/repository/typestructure',
    method: 'POST',
    timeout: 0,
    headers: { Accept: accept },
  });
}
