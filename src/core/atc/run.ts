/**
 * ATC (ABAP Test Cockpit) low-level operations
 *
 * Implements the worklist+run flow:
 *   1. POST /sap/bc/adt/atc/worklists?checkVariant=X  -> worklistId (32-char GUID)
 *   2. POST /sap/bc/adt/atc/runs?worklistId=X&clientWait=false  -> runId via Location header
 *   3. GET  /sap/bc/adt/atc/runs/{runId}  -> poll status until finished
 *   4. GET  /sap/bc/adt/atc/worklists/{worklistId}  -> findings
 */

import type {
  AtcFindingsFormat,
  AtcObjectType,
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_ATC_CUSTOMIZING,
  ACCEPT_ATC_RUN_RESPONSE,
  ACCEPT_ATC_RUN_STATUS,
  ACCEPT_ATC_VARIANTS,
  ACCEPT_ATC_WORKLIST_CHECKSTYLE,
  ACCEPT_ATC_WORKLIST_ID,
  ACCEPT_ATC_WORKLIST_XML,
  CT_ATC_RUN,
  CT_ATC_WORKLIST_CREATE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const ATC_PATH_BASE = '/sap/bc/adt/atc';

/**
 * Build the ADT object URI for an ATC-checkable object.
 * Matches the URI families ATC accepts in the run request body.
 */
export function buildAtcObjectUri(
  objectType: AtcObjectType,
  objectName: string,
): string {
  const encoded = encodeSapObjectName(objectName).toUpperCase();
  switch (objectType) {
    case 'class':
      return `/sap/bc/adt/oo/classes/${encoded}`;
    case 'interface':
      return `/sap/bc/adt/oo/interfaces/${encoded}`;
    case 'program':
    case 'include':
      return `/sap/bc/adt/programs/programs/${encoded}`;
    case 'function_group':
      return `/sap/bc/adt/functions/groups/${encoded}`;
    case 'package':
      return `/sap/bc/adt/packages/${encoded}`;
    default: {
      const exhaustive: never = objectType;
      throw new Error(`Unsupported ATC object type: ${String(exhaustive)}`);
    }
  }
}

/**
 * Create an ATC worklist for a given check variant.
 * Returns the response whose body contains a 32-character GUID worklistId.
 */
export async function createAtcWorklist(
  connection: IAbapConnection,
  checkVariant: string,
): Promise<AxiosResponse> {
  if (!checkVariant) {
    throw new Error('checkVariant is required to create an ATC worklist');
  }
  const url = `${ATC_PATH_BASE}/worklists?checkVariant=${encodeURIComponent(checkVariant)}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: '',
    headers: {
      'Content-Type': CT_ATC_WORKLIST_CREATE,
      Accept: ACCEPT_ATC_WORKLIST_ID,
    },
  });
}

/**
 * Submit an asynchronous ATC run against an ADT object URI.
 * Returns the response whose Location header contains the run path
 * (e.g. /sap/bc/adt/atc/runs/{runId}).
 */
export async function startAtcRun(
  connection: IAbapConnection,
  worklistId: string,
  objectUri: string,
  maxFindings: number = 100,
): Promise<AxiosResponse> {
  if (!worklistId) {
    throw new Error('worklistId is required to start an ATC run');
  }
  if (!objectUri) {
    throw new Error('objectUri is required to start an ATC run');
  }
  const url = `${ATC_PATH_BASE}/runs?worklistId=${encodeURIComponent(worklistId)}&clientWait=false`;
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<atc:run maximumVerdicts="${maxFindings}" xmlns:atc="http://www.sap.com/adt/atc">` +
    '<objectSets xmlns:adtcore="http://www.sap.com/adt/core">' +
    '<objectSet kind="inclusive">' +
    '<adtcore:objectReferences>' +
    `<adtcore:objectReference adtcore:uri="${objectUri}"/>` +
    '</adtcore:objectReferences>' +
    '</objectSet>' +
    '</objectSets>' +
    '</atc:run>';
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: body,
    headers: {
      'Content-Type': CT_ATC_RUN,
      Accept: ACCEPT_ATC_RUN_RESPONSE,
    },
  });
}

/**
 * Read the status of an asynchronous ATC run.
 * Response body contains status="finished" / status="cancelled" / status="running".
 */
export async function getAtcRunStatus(
  connection: IAbapConnection,
  runId: string,
  withLongPolling: boolean = true,
): Promise<AxiosResponse> {
  if (!runId) {
    throw new Error('runId is required');
  }
  const query = withLongPolling ? '?withLongPolling=true' : '';
  return connection.makeAdtRequest({
    url: `${ATC_PATH_BASE}/runs/${encodeURIComponent(runId)}${query}`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_ATC_RUN_STATUS,
    },
  });
}

/**
 * Fetch ATC findings for a completed worklist.
 * Format defaults to native XML; 'checkstyle' returns the Checkstyle XML flavor
 * which is easier to consume from external tooling.
 */
export async function getAtcWorklistFindings(
  connection: IAbapConnection,
  worklistId: string,
  options?: { format?: AtcFindingsFormat; includeExemptedFindings?: boolean },
): Promise<AxiosResponse> {
  if (!worklistId) {
    throw new Error('worklistId is required');
  }
  const format = options?.format ?? 'xml';
  const includeExempted = options?.includeExemptedFindings ?? false;
  const accept =
    format === 'checkstyle'
      ? ACCEPT_ATC_WORKLIST_CHECKSTYLE
      : ACCEPT_ATC_WORKLIST_XML;
  const url = `${ATC_PATH_BASE}/worklists/${encodeURIComponent(worklistId)}?includeExemptedFindings=${includeExempted ? 'true' : 'false'}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: accept,
    },
  });
}

/**
 * List available ATC check variants on the system.
 */
export async function listAtcVariants(
  connection: IAbapConnection,
  options?: { maxItemCount?: number; namePattern?: string },
): Promise<AxiosResponse> {
  const max = options?.maxItemCount ?? 500;
  const name = options?.namePattern ?? '*';
  const url = `${ATC_PATH_BASE}/variants?maxItemCount=${max}&name=${encodeURIComponent(name)}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_ATC_VARIANTS,
    },
  });
}

/**
 * Read ATC customizing to extract the system default check variant.
 * Returns the customizing XML response; parsing is the caller's concern.
 */
export async function getAtcCustomizing(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  return connection.makeAdtRequest({
    url: `${ATC_PATH_BASE}/customizing`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_ATC_CUSTOMIZING,
    },
  });
}

/**
 * Parse the systemCheckVariant property out of an ATC customizing response.
 * Returns null when no system default is configured.
 */
export function parseSystemDefaultVariant(
  customizingBody: string | undefined,
): string | null {
  if (!customizingBody || typeof customizingBody !== 'string') {
    return null;
  }
  const match = customizingBody.match(
    /name="systemCheckVariant"[^>]*value="([^"]+)"/,
  );
  return match ? match[1] : null;
}

/**
 * Extract the runId from an ATC run response.
 * SAP returns the run path via the Location header; the runId is the final segment.
 */
export function extractAtcRunId(response: AxiosResponse): string | undefined {
  const headers = response.headers ?? {};
  const location =
    (typeof headers.location === 'string' ? headers.location : undefined) ??
    (typeof headers.Location === 'string' ? headers.Location : undefined) ??
    (typeof headers['content-location'] === 'string'
      ? headers['content-location']
      : undefined);
  if (!location) {
    return undefined;
  }
  const segments = location.split('/').filter((s) => s.length > 0);
  return segments[segments.length - 1];
}

/**
 * Extract the worklistId from a worklist creation response body.
 * The body is a plain-text 32-character GUID.
 */
export function extractAtcWorklistId(
  response: AxiosResponse,
): string | undefined {
  const data = response.data;
  if (typeof data !== 'string') {
    return undefined;
  }
  const trimmed = data.trim();
  return trimmed.length === 32 ? trimmed : undefined;
}
