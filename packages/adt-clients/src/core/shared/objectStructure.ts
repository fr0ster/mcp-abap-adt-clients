/**
 * Object structure operations for ABAP objects
 *
 * Retrieves ADT object structure as compact JSON tree.
 */

import type { AdtReadVersion, AdtTypeCode } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  CLASS,
  FUNCTION_GROUP,
  INTERFACE,
  PROGRAM,
  PROGRAM_INCLUDE,
} from '../../endpoints/objects';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { readQuery } from './readQuery';

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
  objectType: AdtTypeCode,
  objectName: string,
): Promise<IAdtWireResponse> {
  const encodedType = encodeURIComponent(objectType);
  const encodedName = encodeURIComponent(encodeSapObjectName(objectName));
  const url = `/sap/bc/adt/repository/objectstructure?objecttype=${encodedType}&objectname=${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept:
        'application/vnd.sap.adt.projectexplorer.objectstructure+xml, application/xml',
    },
  });
}

/**
 * The objects SAP serves an outline for, and each one's address. Measured on
 * premise and on ABAP cloud (2026-11-04): `<object uri>/objectstructure`
 * answers for a class, an interface, a program, an include and a function
 * group (the program and the include on premise only — the cloud has none);
 * a function module, a structure, a service definition and a class's local
 * includes answer `404`. The discovery document lists no per-object template;
 * the metadata of the four main kinds links it as `rel=…/objectstructure`.
 */
const OUTLINE_ADDRESS = {
  'CLAS/OC': CLASS.uri,
  'INTF/OI': INTERFACE.uri,
  'PROG/P': PROGRAM.uri,
  'PROG/I': PROGRAM_INCLUDE.uri,
  'FUGR/F': FUNCTION_GROUP.uri,
} satisfies Partial<Record<AdtTypeCode, (name: string) => string>>;

/** A kind SAP serves an outline for. */
export type AdtOutlineCode = keyof typeof OUTLINE_ADDRESS;

/**
 * The one media type the outline answers for every kind: a program, an
 * include and a function group answer `406` to any other (a class and an
 * interface also take `…objectstructure+xml` and `application/xml`, with the
 * same body).
 */
export const ACCEPT_OBJECT_OUTLINE =
  'application/vnd.sap.adt.objectstructure.v2+xml';

/**
 * An object's outline — `GET <object uri>/objectstructure`, the structure
 * Eclipse's Outline view reads.
 *
 * The answer is nested `abapsource:objectStructureElement`s, each with its
 * `adtcore:type` and `adtcore:name` and `atom:link`s whose `rel` ends in
 * `definitionIdentifier`, `implementationIdentifier`, `definitionBlock` or
 * `implementationBlock`. For a class and an interface each link names a
 * position, `#start=l,c;end=l,c` (lines from 1, columns from 0, `end`
 * exclusive) in the include it points into; a program's and a function
 * group's links name their target, not a position. No element carries a
 * signature. `version` changes only the answer's `xml:base`.
 */
export async function getObjectOutline(
  connection: IAbapConnection,
  objectType: AdtOutlineCode,
  objectName: string,
  options?: { version?: AdtReadVersion; accept?: string },
): Promise<IAdtWireResponse> {
  const address = OUTLINE_ADDRESS[objectType];
  return connection.makeAdtRequest({
    url: `${address(objectName)}/objectstructure${readQuery(options?.version, undefined)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_OBJECT_OUTLINE },
  });
}
