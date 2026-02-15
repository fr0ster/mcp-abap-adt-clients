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
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

export interface IProfilerTraceParameters {
  allMiscAbapStatements?: boolean;
  allProceduralUnits?: boolean;
  allInternalTableEvents?: boolean;
  allDynproEvents?: boolean;
  description?: string;
  aggregate?: boolean;
  explicitOnOff?: boolean;
  withRfcTracing?: boolean;
  allSystemKernelEvents?: boolean;
  sqlTrace?: boolean;
  allDbEvents?: boolean;
  maxSizeForTraceFile?: number;
  amdpTrace?: boolean;
  maxTimeForTracing?: number;
}

export interface IProfilerTraceHitListOptions {
  withSystemEvents?: boolean;
}

export interface IProfilerTraceStatementsOptions {
  id?: number;
  withDetails?: boolean;
  autoDrillDownThreshold?: number;
  withSystemEvents?: boolean;
}

export interface IProfilerTraceDbAccessesOptions {
  withSystemEvents?: boolean;
}

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
  if (!trimmed) {
    throw new Error('Trace ID is required');
  }
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
  if (!traceIdOrUri) {
    throw new Error('Trace ID is required');
  }
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
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;
  const data = buildTraceParametersXml(options);
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    data,
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
      'Content-Type': 'application/xml',
    },
  });
}

export function extractProfilerIdFromResponse(
  response: AxiosResponse,
): string | undefined {
  const headers = response?.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const location =
    headers?.location ??
    headers?.Location ??
    headers?.['content-location'] ??
    headers?.['Content-Location'];
  if (typeof location !== 'string' || !location.trim()) {
    return undefined;
  }
  const value = location.trim();
  if (value.startsWith('/')) {
    return value;
  }
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

const TRACE_ID_REGEX =
  /\/sap\/bc\/adt\/runtime\/traces\/abaptraces\/([A-Za-z0-9]{16,})(?=\/|[?&#"'\s]|$)/g;

export function extractTraceIdFromTraceRequestsResponse(
  response: AxiosResponse,
): string | undefined {
  const headers = response?.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const headerCandidates = [
    headers?.location,
    headers?.Location,
    headers?.['content-location'],
    headers?.['Content-Location'],
  ];
  for (const candidate of headerCandidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const match = [...candidate.matchAll(TRACE_ID_REGEX)][0];
    if (match?.[1]) {
      return match[1];
    }
  }

  const body =
    typeof response?.data === 'string'
      ? response.data
      : JSON.stringify(response?.data ?? '');
  const match = [...body.matchAll(TRACE_ID_REGEX)][0];
  if (match?.[1]) {
    return match[1];
  }
  return undefined;
}

/**
 * Get profiler trace hitlist
 *
 * @param connection - ABAP connection
 * @param traceIdOrUri - Trace ID (or full trace URI)
 * @param options - Optional filters
 * @returns Axios response with trace hitlist
 */
export async function getTraceHitList(
  connection: IAbapConnection,
  traceIdOrUri: string,
  options: IProfilerTraceHitListOptions = {},
): Promise<AxiosResponse> {
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
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
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
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
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
      Accept: 'application/xml',
    },
  });
}

/**
 * List trace files
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of trace files
 */
export async function listTraceFiles(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  // Note: Same endpoint as getTraceParameters, but used for callstack aggregation
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  // Note: Same endpoint as getTraceParameters, but used for AMDP trace
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * List trace requests
 *
 * @param connection - ABAP connection
 * @returns Axios response with list of trace requests
 */
export async function listTraceRequests(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/requests`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  if (!uri) {
    throw new Error('URI is required');
  }

  const url = `/sap/bc/adt/runtime/traces/abaptraces/requests?uri=${encodeURIComponent(uri)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
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
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/processtypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
