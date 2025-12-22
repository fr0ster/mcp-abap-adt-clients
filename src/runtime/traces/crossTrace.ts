/**
 * ABAP Cross Trace
 *
 * Provides functions for managing ABAP cross traces:
 * - List traces with filters
 * - Get trace details (with optional sensitive data)
 * - Get trace records
 * - Get record content
 * - Get trace activations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * List traces options
 */
export interface IListCrossTracesOptions {
  traceUser?: string;
  actCreateUser?: string;
  actChangeUser?: string;
}

/**
 * List cross traces
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with list of traces
 */
export async function listCrossTraces(
  connection: IAbapConnection,
  options?: IListCrossTracesOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/crosstrace/traces`;
  const params: Record<string, any> = {};

  if (options?.traceUser) params.traceUser = options.traceUser;
  if (options?.actCreateUser) params.actCreateUser = options.actCreateUser;
  if (options?.actChangeUser) params.actChangeUser = options.actChangeUser;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get trace details
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param includeSensitiveData - Whether to include sensitive data
 * @returns Axios response with trace details
 */
export async function getCrossTrace(
  connection: IAbapConnection,
  traceId: string,
  includeSensitiveData?: boolean,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/crosstrace/traces/${traceId}`;
  const params: Record<string, any> = {};

  if (includeSensitiveData !== undefined)
    params.includeSensitiveData = includeSensitiveData;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}

/**
 * Get trace records
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @returns Axios response with trace records
 */
export async function getCrossTraceRecords(
  connection: IAbapConnection,
  traceId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/crosstrace/traces/${traceId}/records`;

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
 * Get trace record content
 *
 * @param connection - ABAP connection
 * @param traceId - Trace ID
 * @param recordNumber - Record number
 * @returns Axios response with record content
 */
export async function getCrossTraceRecordContent(
  connection: IAbapConnection,
  traceId: string,
  recordNumber: number,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/crosstrace/traces/${traceId}/records/${recordNumber}/content`;

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
 * Get trace activations
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace activations
 */
export async function getCrossTraceActivations(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/crosstrace/activations`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
