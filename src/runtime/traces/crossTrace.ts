/**
 * ABAP Cross Trace
 *
 * Provides functions for managing ABAP cross traces:
 * - List traces with filters
 * - Get trace details (with optional sensitive data)
 * - Get trace records
 * - Get record content
 * - Get trace activations
 *
 * **Nothing here has a measured non-empty shape.** Both a modern on-prem system
 * and a cloud trial answered `200` with an empty root — `<sxt:traces/>` and
 * `<sxt:activations/>` — under the typed content types. That is an answer, not
 * a gap: the endpoints exist and are served. It does mean any assumption about
 * the contents of an entry is unevidenced, so the readers hand the body back
 * rather than shaping it.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
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
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/crosstrace/traces`;
  const params: Record<string, string | number | boolean> = {};

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
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/crosstrace/traces/${traceId}`;
  const params: Record<string, string | number | boolean> = {};

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
): Promise<IAdtResponse> {
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
): Promise<IAdtResponse> {
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
): Promise<IAdtResponse> {
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
