/**
 * ATC check runs: the five requests a run is made of.
 *
 * The traffic here was captured against a cloud trial rather than taken from
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
  AtcObjectType,
  IAbapConnection,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_ATC_CUSTOMIZING,
  ACCEPT_ATC_RUN_RESPONSE,
  ACCEPT_ATC_RUN_STATUS,
  ACCEPT_ATC_WORKLIST_ID,
  ACCEPT_ATC_WORKLIST_XML,
  CT_ATC_RUN,
  CT_ATC_WORKLIST_CREATE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const ATC = '/sap/bc/adt/atc';

/**
 * Where each checkable kind lives.
 *
 * Every template was confirmed by a run submitted at it whose finished
 * worklist then listed the object under that type — see
 * `docs/evidence/2026-08-17-atc-objecttype-confirmed.md`. A run being accepted
 * proved nothing: a URI that cannot exist is answered 201 too.
 *
 * `program` and `include` are absent from `AtcObjectType` and so from here.
 * The outside PR this work started from sent includes to
 * `/programs/programs/`, which this library builds as `/programs/includes/`
 * everywhere else; neither could be settled on a system that refuses to hold
 * either kind.
 */
const URI_TEMPLATES: Record<AtcObjectType, string> = {
  class: '/sap/bc/adt/oo/classes/',
  interface: '/sap/bc/adt/oo/interfaces/',
  function_group: '/sap/bc/adt/functions/groups/',
  package: '/sap/bc/adt/packages/',
  ddl_source: '/sap/bc/adt/ddic/ddl/sources/',
  table: '/sap/bc/adt/ddic/tables/',
  behavior_definition: '/sap/bc/adt/bo/behaviordefinitions/',
};

/** The ADT URI ATC checks an object at. */
export function buildAtcObjectUri(
  objectType: AtcObjectType,
  objectName: string,
): string {
  return `${URI_TEMPLATES[objectType]}${encodeSapObjectName(objectName).toUpperCase()}`;
}

/**
 * ATC customizing, which carries the system's default check variant.
 *
 * `GET`, not `POST`: the same path answers a POST with **405, "Resource
 * controller does not support method POST"**.
 */
export async function getAtcCustomizing(
  connection: IAbapConnection,
): Promise<IAdtResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/customizing`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ATC_CUSTOMIZING },
  });
}

/**
 * Create the worklist a run writes its findings into.
 *
 * Answers with a bare id in the body — no XML envelope, which is why both
 * content types are `text/plain`.
 */
export async function createAtcWorklist(
  connection: IAbapConnection,
  checkVariant: string,
): Promise<IAdtResponse> {
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
): Promise<IAdtResponse> {
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
): Promise<IAdtResponse> {
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
): Promise<IAdtResponse> {
  return connection.makeAdtRequest({
    url: `${ATC}/worklists/${encodeURIComponent(worklistId)}?includeExemptedFindings=false`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
  });
}
