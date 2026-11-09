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
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IAnalyse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { fetchInactiveObjects } from '../core/shared/getInactiveObjects';
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
import {
  answeringExchange,
  type IAdtExchange,
  isUnansweredCredentialRefusal,
  recogniseFailure,
} from './adtResponse';
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
 * @param preaudit - Sent as `preauditRequested`. No default: the member
 *   decides it, once, from its option
 * @returns Axios response with activation result
 */
export async function activateObjectInSession(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  objectUri: string,
  objectName: string,
  preaudit: boolean,
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

// ---------------------------------------------------------------------------
// The one read after a silent checklist (spec D1, decision Q7)
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

/** Whether a parsed value is an element: what the parser makes of one. */
function isElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A field of a parsed element; `undefined` for anything else. */
function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

/** One element or several, as a list. */
function listOf(value: unknown): unknown[] {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

/** A well-formed XML document, parsed; `undefined` for anything else. */
function parsedXml(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== 'string' || body.trim() === '') return undefined;
  if (XMLValidator.validate(body) !== true) return undefined;
  const parsed: unknown = parser.parse(body);
  return isElement(parsed) ? parsed : undefined;
}

/**
 * Whether an activation answered the silent checklist: a `2xx`
 * `chkl:messages` with `activationExecuted="false"` and no `msg`. The one
 * answer the document alone cannot judge — it answered both a re-activation
 * that had nothing to do and an activation that left a function group
 * inactive (S/4HANA 2025).
 */
function isSilentChecklist(answer: IAdtWireResponse): boolean {
  if (answer.status < 200 || answer.status >= 300) return false;
  const root = parsedXml(answer.data);
  if (root === undefined || !Object.hasOwn(root, 'messages')) return false;
  const checklist = field(root, 'messages');
  const executed = field(field(checklist, 'properties'), '@activationExecuted');
  return executed === 'false' && listOf(field(checklist, 'msg')).length === 0;
}

/** The `adtcore:uri` of every reference an activation request sent. */
function namedIn(request: IAbapRequestOptions | undefined): string[] {
  const references = field(
    field(parsedXml(request?.data), 'objectReferences'),
    'objectReference',
  );
  return listOf(references).flatMap((reference) => {
    const uri = field(reference, '@uri');
    return typeof uri === 'string' ? [uri] : [];
  });
}

/**
 * The connection a low-level activation function is given: the member's own,
 * keeping the request it sends, so the read after it names what that request
 * named — taken from the body sent, not built a second time.
 */
function keepingRequests(
  connection: IAbapConnection,
  sent: IAbapRequestOptions[],
): IAbapConnection {
  return {
    connect: () => connection.connect(),
    getBaseUrl: () => connection.getBaseUrl(),
    getSessionId: () => connection.getSessionId(),
    setSessionType: (type) => connection.setSessionType(type),
    makeAdtRequest: <T, D>(options: IAbapRequestOptions) => {
      sent.push(options);
      return connection.makeAdtRequest<T, D>(options);
    },
  };
}

/**
 * An activation, and the one read its answer may need.
 *
 * **The one exception to "a member issues one request"** (spec D1, decision
 * Q7). `send` issues the activation — `POST /sap/bc/adt/activation` — and
 * after a silent checklist alone (`activationExecuted="false"`, no message)
 * this reads `GET /sap/bc/adt/activation/inactiveobjects` once, with the
 * `Accept` `getInactiveObjects` sends, and hands the list and the uris the
 * request named to `analyse` as `context.activation`. After every other
 * answer, and when the activation itself failed, nothing more is sent.
 *
 * A read that fails is the call's failure: the verdict `analyse` starts from
 * names that the activation's outcome could not be decided and carries the
 * read's response; the activation's answer stays the one a cleared verdict is
 * read from. A credential refusal SAP never saw is thrown as it came.
 */
async function activationExchange(
  connection: IAbapConnection,
  send: (connection: IAbapConnection) => Promise<IAdtWireResponse>,
): Promise<IAdtExchange> {
  const sent: IAbapRequestOptions[] = [];
  const answer = await send(keepingRequests(connection, sent));
  if (!isSilentChecklist(answer)) return { answer };

  const named = namedIn(sent.find((request) => request.method === 'POST'));
  try {
    const inactiveObjects = await fetchInactiveObjects(connection);
    return { answer, context: { activation: { named, inactiveObjects } } };
  } catch (error: unknown) {
    if (isUnansweredCredentialRefusal(error)) throw error;
    const cause = recogniseFailure(error);
    return {
      answer,
      failure: {
        ...cause,
        message: `The activation's outcome could not be decided: SAP answered that no activation ran and gave no message, and reading the inactive objects failed: ${cause.message}`,
      },
    };
  }
}

/**
 * Run an activation member's request through {@link activationExchange} and
 * compose the two strategies over its answer, as `answering` does. Exported
 * beside `answering` for the handler classes built on this package (the
 * legacy package's activation overrides); the read itself is not.
 */
export function answeringActivation<T, E extends IAdtError = IAdtError>(
  connection: IAbapConnection,
  send: (connection: IAbapConnection) => Promise<IAdtWireResponse>,
  read: IResultStrategy<T>,
  analyse?: IAnalyse<E>,
): Promise<IAdtResponse<T, E>> {
  return answeringExchange(
    () => activationExchange(connection, send),
    read,
    analyse,
  );
}
