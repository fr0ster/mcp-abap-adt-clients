/**
 * ABAP Profiler Traces
 *
 * Provides functions for managing and retrieving ABAP profiler traces:
 * - Trace files listing
 * - Trace parameters (general, callstack aggregation, AMDP)
 * - Trace requests
 * - Object types and process types
 */

import type {
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_TRACE_CALLTREE,
  ACCEPT_TRACE_FEED,
  ACCEPT_TRACE_XML,
  CT_TRACE_PARAMETERS,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

// Declared once, in the contract; re-exported so importers here are unchanged.
export type {
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
} from '@mcp-abap-adt/interfaces-adt';

export const DEFAULT_PROFILER_TRACE_PARAMETERS: Omit<
  IProfilerTraceParameters,
  'description'
> = {
  allMiscAbapStatements: false,
  allProceduralUnits: true,
  allInternalTableEvents: false,
  allDynproEvents: false,
  aggregate: false,
  explicitOnOff: false,
  withRfcTracing: true,
  allSystemKernelEvents: false,
  sqlTrace: true,
  allDbEvents: true,
  maxSizeForTraceFile: 30720,
  amdpTrace: true,
  maxTimeForTracing: 1800,
};

function escapeXmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function toTraceId(value: string): string {
  const trimmed = value.trim();
  const marker = '/sap/bc/adt/runtime/traces/abaptraces/';
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    const rest = trimmed.slice(markerIndex + marker.length);
    const slashIndex = rest.indexOf('/');
    const queryIndex = rest.indexOf('?');
    const hashIndex = rest.indexOf('#');
    let end = rest.length;
    for (const idx of [slashIndex, queryIndex, hashIndex]) {
      if (idx >= 0 && idx < end) {
        end = idx;
      }
    }
    const id = rest.slice(0, end).trim();
    if (id) {
      return id;
    }
  }
  return trimmed;
}

export function normalizeProfilerTraceId(traceIdOrUri: string): string {
  return toTraceId(String(traceIdOrUri));
}

function boolToQueryValue(value: boolean | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? 'true' : 'false';
}

export function buildTraceParametersXml(
  options: IProfilerTraceParameters = {},
): string {
  const merged: IProfilerTraceParameters = {
    ...DEFAULT_PROFILER_TRACE_PARAMETERS,
    ...options,
  };
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<trc:parameters xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces">',
  ];
  const appendBoolean = (
    name: keyof IProfilerTraceParameters,
    value: boolean | undefined,
  ): void => {
    if (value === undefined) {
      return;
    }
    lines.push(`  <trc:${name} value="${value ? 'true' : 'false'}"/>`);
  };
  const appendNumber = (
    name: keyof IProfilerTraceParameters,
    value: number | undefined,
  ): void => {
    if (value === undefined || Number.isNaN(value)) {
      return;
    }
    lines.push(`  <trc:${name} value="${Math.trunc(value)}"/>`);
  };
  appendBoolean('allMiscAbapStatements', merged.allMiscAbapStatements);
  appendBoolean('allProceduralUnits', merged.allProceduralUnits);
  appendBoolean('allInternalTableEvents', merged.allInternalTableEvents);
  appendBoolean('allDynproEvents', merged.allDynproEvents);
  if (merged.description !== undefined) {
    lines.push(
      `  <trc:description value="${escapeXmlAttr(String(merged.description))}"/>`,
    );
  }
  appendBoolean('aggregate', merged.aggregate);
  appendBoolean('explicitOnOff', merged.explicitOnOff);
  appendBoolean('withRfcTracing', merged.withRfcTracing);
  appendBoolean('allSystemKernelEvents', merged.allSystemKernelEvents);
  appendBoolean('sqlTrace', merged.sqlTrace);
  appendBoolean('allDbEvents', merged.allDbEvents);
  appendNumber('maxSizeForTraceFile', merged.maxSizeForTraceFile);
  appendBoolean('amdpTrace', merged.amdpTrace);
  appendNumber('maxTimeForTracing', merged.maxTimeForTracing);
  lines.push('</trc:parameters>');
  return lines.join('\n');
}

export async function createTraceParameters(
  connection: IAbapConnection,
  options: IProfilerTraceParameters = {},
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
  const data = buildTraceParametersXml(options);
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    data,
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
      'Content-Type': CT_TRACE_PARAMETERS,
    },
  });
}

/**
 * Delete a trace.
 *
 * ADT advertises this on the trace itself: every feed entry carries
 * `<atom:link rel="http://www.sap.com/adt/relations/delete">` pointing at the
 * trace URI, beside the links for its three views. Measured on an on-prem
 * system: the `DELETE` answers `200`.
 *
 * Takes an id or a full URI, like every other trace reader here, so a caller
 * can hand back what `list()` gave it without unpicking the URI first.
 */
export async function deleteTrace(
  connection: IAbapConnection,
  traceIdOrUri: string,
): Promise<IAdtWireResponse> {
  const traceId = normalizeProfilerTraceId(traceIdOrUri);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
    headers: {},
  });
}

export async function getTraceHitList(
  connection: IAbapConnection,
  traceIdOrUri: string,
  options: IProfilerTraceHitListOptions = {},
): Promise<IAdtWireResponse> {
  const traceId = normalizeProfilerTraceId(traceIdOrUri);
  const params = new URLSearchParams();
  const withSystemEvents = boolToQueryValue(options.withSystemEvents);
  if (withSystemEvents !== undefined) {
    params.set('withSystemEvents', withSystemEvents);
  }
  const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/hitlist${params.toString() ? `?${params.toString()}` : ''}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * Get profiler trace statements
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional statement filters
 * @returns Axios response with trace statements
 */
export async function getTraceStatements(
  connection: IAbapConnection,
  traceIdOrUri: string,
  options: IProfilerTraceStatementsOptions = {},
): Promise<IAdtWireResponse> {
  const traceId = normalizeProfilerTraceId(traceIdOrUri);
  const params = new URLSearchParams();
  if (options.id !== undefined) {
    params.set('id', String(Math.trunc(options.id)));
  }
  const withDetails = boolToQueryValue(options.withDetails);
  if (withDetails !== undefined) {
    params.set('withDetails', withDetails);
  }
  if (options.autoDrillDownThreshold !== undefined) {
    params.set(
      'autoDrillDownThreshold',
      String(Math.trunc(options.autoDrillDownThreshold)),
    );
  }
  const withSystemEvents = boolToQueryValue(options.withSystemEvents);
  if (withSystemEvents !== undefined) {
    params.set('withSystemEvents', withSystemEvents);
  }
  const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/statements${params.toString() ? `?${params.toString()}` : ''}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_CALLTREE,
    },
  });
}

/**
 * Get profiler trace DB accesses
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with DB accesses
 */
export async function getTraceDbAccesses(
  connection: IAbapConnection,
  traceIdOrUri: string,
  options: IProfilerTraceDbAccessesOptions = {},
): Promise<IAdtWireResponse> {
  const traceId = normalizeProfilerTraceId(traceIdOrUri);
  const params = new URLSearchParams();
  const withSystemEvents = boolToQueryValue(options.withSystemEvents);
  if (withSystemEvents !== undefined) {
    params.set('withSystemEvents', withSystemEvents);
  }
  const url = `/sap/bc/adt/runtime/traces/abaptraces/${encodeURIComponent(traceId)}/dbAccesses${params.toString() ? `?${params.toString()}` : ''}`;
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * List trace files
 *
 * @param connection - ABAP connection
 * @param options - Optional filters (user)
 * @returns Axios response with list of trace files
 */
export async function listTraceFiles(
  connection: IAbapConnection,
  options?: { user?: string },
): Promise<IAdtWireResponse> {
  const params = new URLSearchParams();
  if (options?.user) {
    params.set('user', options.user);
  }
  const qs = params.toString();
  const url = `/sap/bc/adt/runtime/traces/abaptraces${qs ? `?${qs}` : ''}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * Get trace parameters
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace parameters
 */
export async function getTraceParameters(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * Get trace parameters for callstack aggregation
 *
 * @param connection - ABAP connection
 * @returns Axios response with callstack aggregation parameters
 */
export async function getTraceParametersForCallstack(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * Get trace parameters for AMDP trace
 *
 * @param connection - ABAP connection
 * @returns Axios response with AMDP trace parameters
 */
export async function getTraceParametersForAmdp(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * List trace requests.
 *
 * Serves `application/atom+xml;type=feed` and nothing else. Asking for
 * `application/xml` answers **400 `acceptHeaderMissing`** — "Accept header
 * missing" for an Accept that was sent and simply is not served. Measured;
 * recorded because the message points away from the cause and cost a detour
 * once already.
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of trace requests
 */
export async function listTraceRequests(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/requests`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_FEED,
    },
  });
}

/**
 * Get trace requests filtered by URI
 *
 * @param connection - ABAP connection
 * @param uri - Object URI to filter by
 * @returns Axios response with filtered trace requests
 */
export async function getTraceRequestsByUri(
  connection: IAbapConnection,
  uri: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/requests?uri=${encodeURIComponent(uri)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_FEED,
    },
  });
}

/**
 * List available object types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of object types
 */
export async function listObjectTypes(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}

/**
 * List available process types for tracing
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of process types
 */
export async function listProcessTypes(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/processtypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_TRACE_XML,
    },
  });
}
