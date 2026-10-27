/**
 * Activation Utilities - Centralized ABAP Object Activation Functions
 *
 * Two types of activation endpoints:
 * 1. Individual activation: /sap/bc/adt/activation (for single object in session)
 * 2. Group activation: /sap/bc/adt/activation/runs (for multiple objects)
 */

import type {
  AdtParentedTypeCode,
  AdtTypeCode,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  type AdtAddressableCode,
  codeEntries,
  GROUP_ONLY_ADDRESS,
  isGroupOnlyCode,
  NO_OWN_ADDRESS,
  PARENTED_SEGMENT,
  parentEntry,
} from '../endpoints/codes';
import { seg } from '../endpoints/objects';
import { requestHeaders } from './requestHeaders';

/** {@link PARENTED_SEGMENT}, read by any code: absent for an unparented one. */
const PARENTED_SEGMENT_BY_CODE: Readonly<Partial<Record<string, string>>> =
  PARENTED_SEGMENT;

/**
 * What `buildObjectUri` takes after the code: the parent's name, required for
 * a code that lives under a parent (`FUGR/FF`, `FUGR/I`) and optional
 * otherwise. Not distributive, like `IObjectReference`: a code typed
 * `AdtTypeCode` leaves it optional, and the address is refused at run time
 * when it is missing.
 */
export type ParentArgument<C extends string> = [C] extends [AdtParentedTypeCode]
  ? [parentName: string]
  : [parentName?: string];

/**
 * An object's ADT address, from the type tables of
 * `@mcp-abap-adt/interfaces-adt`: its code's collection followed by its name,
 * or, for a code with a parent API, the parent's address, the code's segment
 * and its name. Used by individual and group activation, group deletion and
 * where-used.
 *
 * @param name - Object name (e.g., 'ZCL_MY_CLASS', 'Z_MY_PROGRAM')
 * @param type - A code with an address (e.g., 'CLAS/OC', 'PROG/P', 'DDLS/DF'):
 *   a code of the tables but `MSAG/NN`, or a group-only code (`VIEW/DV`)
 * @param parentName - The parent's name, for a parented code (the function group of 'FUGR/FF')
 * @returns ADT URI for the object
 */
export function buildObjectUri<C extends AdtAddressableCode>(
  name: string,
  type: C,
  ...[parentName]: ParentArgument<C>
): string {
  if (isGroupOnlyCode(type)) return GROUP_ONLY_ADDRESS[type](name);
  const [first] = codeEntries(type);
  // Only a caller outside the type system reaches this: a code no table names
  // is no `AdtTypeCode`. It is their argument, refused before any request.
  if (!first) {
    throw new Error(
      `No ADT address is known for object type '${type}' (${name}); pass a code of the ADT type tables, e.g. CLAS/OC, PROG/P, PROG/I, FUGR/I.`,
    );
  }
  const irregular = NO_OWN_ADDRESS[type];
  if (irregular) {
    throw new Error(`${type} ${name}: ${irregular}`);
  }

  const { entry, facts } = first;
  if (facts.parent === null) {
    return `${facts.collection ?? entry.collection}/${seg(name)}`;
  }

  // A parented code is addressed under its parent, and the address means
  // nothing without it. A reference typed by its code requires the parent; one
  // typed `AdtTypeCode` may lack it, and that is the caller's argument.
  const parent = parentEntry(first, facts.parent);
  const segment: string | undefined = PARENTED_SEGMENT_BY_CODE[type];
  if (!parentName) {
    throw new Error(
      `${type} is addressed under its parent (${facts.parent}); pass the parent's name as parentName for ${name}`,
    );
  }
  if (!parent || !segment) {
    // A table that names a parent API it has no entry for, or a parented code
    // without its segment, is a defect of this library, not the caller's.
    throw new Error(
      `The ADT type tables name no address for ${type} under ${facts.parent}`,
    );
  }
  return `${parent.collection}/${seg(parentName)}/${segment}/${seg(name)}`;
}

/**
 * Individual object activation (within a session)
 * Used by Update/Create handlers after lock/unlock operations
 *
 * @param connection - ABAP connection instance
 * @param objectUri - ADT URI of the object (e.g., '/sap/bc/adt/oo/classes/zcl_test')
 * @param objectName - Object name in uppercase (e.g., 'ZCL_TEST')
 * @param sessionId - Session ID for stateful operations
 * @param preaudit - Request pre-audit before activation (default: true)
 * @returns Axios response with activation result
 */
export async function activateObjectInSession(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  objectUri: string,
  objectName: string,
  preaudit: boolean = true,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=${preaudit}`;

  const activationXml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${objectUri}" adtcore:name="${objectName}"/>
</adtcore:objectReferences>`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: activationXml,
    headers: requestHeaders(headers),
  });

  // The answer, as it arrived. ADT returns 200 even on a failed activation
  // (locked object, syntax errors), so the status does not carry the verdict
  // and neither does this function. Whether a checklist body means the
  // activation happened is read by the caller's own `analyse`.
  return response;
}
