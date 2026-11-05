/**
 * Element info of a structure and of a service definition — what Eclipse
 * shows on a hover over a name in DDIC source.
 *
 * Measured on premise and on ABAP cloud (2026-11-05), the same answers byte
 * for byte where both systems hold the object: one `abapsource:elementInfo`
 * for the object (`adtcore:uri`, `adtcore:type`, `adtcore:name`, its short
 * text) with one nested `abapsource:elementInfo` per component and, last, its
 * package (`DEVC/K`). Both endpoints answer `406` to any Accept but
 * `application/vnd.sap.adt.elementinfo+xml`, and `200` with an element info
 * that names no object for a name that does not exist.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SERVICE_DEFINITION, STRUCTURE } from '../../endpoints/objects';

/** The one media type both element-info endpoints answer. */
export const ACCEPT_ELEMENT_INFO = 'application/vnd.sap.adt.elementinfo+xml';

/**
 * A structure's element info — `GET /sap/bc/adt/ddic/elementinfo?path=<name>`.
 *
 * Every component in order, flat: an include or an append is a `TABL/DS`
 * element named `.include` or `.append` with `ddicIncludeName` and the
 * included structure's source URI, and each field inside it carries
 * `ddicIsPartOfInclude` and `ddicIncludeHierarchyLevel`; nested includes
 * follow the same rule one level down. A named include (`_x : include s`)
 * is an `.include` too: the group name is not stated.
 */
export async function getStructureElementInfo(
  connection: IAbapConnection,
  structureName: string,
  options?: { accept?: string },
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: STRUCTURE.elementInfo(structureName),
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_ELEMENT_INFO },
  });
}

/**
 * A service definition's element info —
 * `GET /sap/bc/adt/ddic/srvd/elementinfo?path=<name>`.
 *
 * One element per exposed entity, with the entity's name as its DDL source
 * writes it, the DDL source URI and an `alias` entry when the `expose` has
 * an `as` (none without); not in source order. Entities exposed by an
 * extension are listed too, and the extension is linked
 * (`rel=…/ddic/srvd/extention`, SAP's spelling).
 */
export async function getServiceDefinitionElementInfo(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  options?: { accept?: string },
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: SERVICE_DEFINITION.elementInfo(serviceDefinitionName),
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_ELEMENT_INFO },
  });
}
