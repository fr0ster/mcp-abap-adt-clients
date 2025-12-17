/**
 * ABAP Profiler Traces
 * 
 * Provides functions for managing and retrieving ABAP profiler traces:
 * - Trace files listing
 * - Trace parameters (general, callstack aggregation, AMDP)
 * - Trace requests
 * - Object types and process types
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * List trace files
 * 
 * @param connection - ABAP connection
 * @returns Axios response with list of trace files
 */
export async function listTraceFiles(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get trace parameters
 * 
 * @param connection - ABAP connection
 * @returns Axios response with trace parameters
 */
export async function getTraceParameters(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get trace parameters for callstack aggregation
 * 
 * @param connection - ABAP connection
 * @returns Axios response with callstack aggregation parameters
 */
export async function getTraceParametersForCallstack(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  // Note: Same endpoint as getTraceParameters, but used for callstack aggregation
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * Get trace parameters for AMDP trace
 * 
 * @param connection - ABAP connection
 * @returns Axios response with AMDP trace parameters
 */
export async function getTraceParametersForAmdp(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  // Note: Same endpoint as getTraceParameters, but used for AMDP trace
  const url = `/sap/bc/adt/runtime/traces/abaptraces/parameters`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * List trace requests
 * 
 * @param connection - ABAP connection
 * @returns Axios response with list of trace requests
 */
export async function listTraceRequests(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/requests`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
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
  uri: string
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
      'Accept': 'application/xml'
    }
  });
}

/**
 * List available object types for tracing
 * 
 * @param connection - ABAP connection
 * @returns Axios response with list of object types
 */
export async function listObjectTypes(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/objecttypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

/**
 * List available process types for tracing
 * 
 * @param connection - ABAP connection
 * @returns Axios response with list of process types
 */
export async function listProcessTypes(
  connection: IAbapConnection
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/runtime/traces/abaptraces/processtypes`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/xml'
    }
  });
}

