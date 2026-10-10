/**
 * ATC check runs: the five requests a run is made of.
 *
 * The traffic here was captured against one system rather than taken from
 * documentation, and two of the headers are the resource rather than a detail:
 * the worklist is created and read as `text/plain` where everything around it
 * is XML, and the run resource answers only to
 * `application/vnd.sap.adt.backgroundrun.v1+xml`. A checkstyle `Accept` on the
 * worklist is refused with 406 naming the one type it will serve, which is why
 * no format option exists.
 *
 * See `docs/evidence/2026-08-16-atc-trial-probe.md` for the captures.
 */

import type {
  AtcNamedObjectType,
  IAtcObjectRef,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_ATC_CUSTOMIZING,
  ACCEPT_ATC_RUN_RESPONSE,
  ACCEPT_ATC_RUN_STATUS,
  ACCEPT_ATC_WORKLIST_ID,
  ACCEPT_ATC_WORKLIST_XML,
  CT_ATC_RUN,
  CT_ATC_WORKLIST_CREATE,
} from '../../constants/contentTypes';
import {
  BEHAVIOR_DEFINITION,
  CLASS,
  CLASS_INCLUDE,
  DDL_SOURCE,
  FUNCTION_GROUP,
  FUNCTION_INCLUDE,
  INTERFACE,
  PACKAGE,
  PROGRAM,
  PROGRAM_INCLUDE,
  TABLE,
} from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

const ATC = '/sap/bc/adt/atc';

/**
 * Where each checkable kind lives — the registry's address for it.
 *
 * Every kind was confirmed by a run submitted at its address whose finished
 * worklist then listed the object. A run being accepted proved nothing: a URI
 * that cannot exist is answered 201 too. Measured on an on-premise and a cloud
 * system (2026-10-01): ATC checks an include as the object that owns it (a
 * program include lists its main program, a function include its group, a
 * class include its class), and a function include is found under its group
 * and not under `/programs/includes/`. ATC listed objects for lowercase
 * references on both.
 */
const NAMED: Record<AtcNamedObjectType, (name: string) => string> = {
  class: CLASS.uri,
  interface: INTERFACE.uri,
  function_group: FUNCTION_GROUP.uri,
  package: PACKAGE.uri,
  ddl_source: DDL_SOURCE.uri,
  table: TABLE.uri,
  behavior_definition: BEHAVIOR_DEFINITION.uri,
  program: PROGRAM.uri,
  program_include: PROGRAM_INCLUDE.uri,
};

/**
 * The ADT URI ATC checks an object at. An include kind is addressed by what
 * owns it, which its reference carries.
 *
 * A kind with no address here is refused loudly rather than built as
 * `"undefined/…"`: `AtcObjectType` grows, and a reference to a kind this
 * version does not know must not become a URI that means nothing.
 */
export function buildAtcObjectUri(ref: IAtcObjectRef): string {
  switch (ref.objectType) {
    case 'function_include':
      return FUNCTION_INCLUDE.uri(ref.functionGroup, ref.objectName);
    case 'class_include':
      return CLASS_INCLUDE.uri(ref.objectName, ref.includeKind);
    default: {
      const build = NAMED[ref.objectType] as
        | ((name: string) => string)
        | undefined;
      if (!build) {
        throw new Error(
          `No ADT URI is known for ATC object type '${String(ref.objectType)}'.`,
        );
      }
      return build(ref.objectName);
    }
  }
}

/**
 * ATC customizing, which carries the system's default check variant.
 *
 * `GET`, not `POST`: the same path answers a POST with **405, "Resource
 * controller does not support method POST"**.
 */
export async function getAtcCustomizing(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/customizing`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ATC_CUSTOMIZING },
  });
}

/**
 * The check variants whose name matches `name` — `/atc/variants`.
 *
 * `name` is a pattern: `*` is a wildcard, the match ignores case, and without
 * a `*` it matches one name exactly (`DEF` finds no `DEFAULT`). It is the
 * argument because the list is empty without it, not complete — a system with
 * every variant looks like one with none. `maxItemCount` limits what comes
 * back; `0` or none is no limit. On SAP_BASIS 758 and 816 the limit was exact;
 * on SAP BTP ABAP Environment a limit of 3 answered 6 (2026-10-10). The
 * answer's `totalItemCount` counts what was returned, not what exists, so a
 * truncated list does not say so. `data`, the other parameter the discovery
 * template names, filtered every name out on all three, and is left out.
 * Answered as `application/xml` (or `…nameditems.v1+xml`); JSON is 406.
 */
export async function listAtcCheckVariants(
  connection: IAbapConnection,
  name: string,
  maxItemCount?: number,
): Promise<IAdtWireResponse> {
  const query = new URLSearchParams({ name });
  if (maxItemCount !== undefined)
    query.set('maxItemCount', String(maxItemCount));
  return connection.makeAdtRequest({
    url: `${ATC}/variants?${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'application/xml' },
  });
}

/**
 * Create the worklist a run writes its findings into.
 *
 * The id this returns is **not** a run id: `GET /atc/runs/{worklistId}` answers
 * 404, measured on-prem over both transports. The run id only ever arrives in
 * the `Location` of the run that was posted.
 *
 * And a worklist lists only objects that produced findings, so an empty one
 * cannot be told apart from "nothing was checked" — which is why a check run
 * reporting `TOOL_FAILURE` is the thing to look at, not the object count.
 *
 * Answers with a bare id in the body — no XML envelope, which is why both
 * content types are `text/plain`.
 */
export async function createAtcWorklist(
  connection: IAbapConnection,
  checkVariant: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/worklists?checkVariant=${encodeURIComponent(checkVariant)}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {
      'Content-Type': CT_ATC_WORKLIST_CREATE,
      Accept: ACCEPT_ATC_WORKLIST_ID,
    },
  });
}

/** The run payload: one inclusive object set, every reference in it. */
export function buildRunPayload(
  objectUris: readonly string[],
  maximumVerdicts: number,
): string {
  const references = objectUris
    .map((uri) => `<adtcore:objectReference adtcore:uri="${uri}"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<atc:run maximumVerdicts="${maximumVerdicts}" xmlns:atc="http://www.sap.com/adt/atc">` +
    '<objectSets xmlns:adtcore="http://www.sap.com/adt/core">' +
    '<objectSet kind="inclusive">' +
    `<adtcore:objectReferences>${references}</adtcore:objectReferences>` +
    '</objectSet>' +
    '</objectSets>' +
    '</atc:run>'
  );
}

/**
 * Start the run.
 *
 * `clientWait` decides the shape of the answer, not just its timing:
 * `false` → 201 with an empty body and the run id in `Location`;
 * `true` → 200 with `<atcworklist:worklistRun>` and no `Location`.
 */
export async function startAtcRun(
  connection: IAbapConnection,
  worklistId: string,
  objectUris: readonly string[],
  maximumVerdicts: number,
  wait: boolean,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/runs?worklistId=${encodeURIComponent(worklistId)}&clientWait=${wait}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildRunPayload(objectUris, maximumVerdicts),
    headers: { 'Content-Type': CT_ATC_RUN, Accept: ACCEPT_ATC_RUN_RESPONSE },
  });
}

/** The run resource, which carries `runs:status` and links to its results. */
export async function getAtcRunStatus(
  connection: IAbapConnection,
  runId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/runs/${encodeURIComponent(runId)}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ATC_RUN_STATUS },
  });
}

/**
 * The worklist: every object the run checked, each with its findings.
 *
 * `includeExemptedFindings=false` is the observed form. `true` was answered
 * once, but the only `false` read happened before a run had finished and the
 * only `true` read after, so the two differ by timing rather than by the flag
 * — which is why it is not an option.
 */
export async function getAtcWorklist(
  connection: IAbapConnection,
  worklistId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/worklists/${encodeURIComponent(worklistId)}?includeExemptedFindings=false`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
  });
}
