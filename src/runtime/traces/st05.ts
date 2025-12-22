/**
 * Performance Trace (ST05)
 *
 * Provides functions for managing ST05 performance traces:
 * - Get trace state
 * - Get trace directory
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ST05 trace state
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace state
 */
export async function getSt05TraceState(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/st05/trace/state`;

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
 * Get ST05 trace directory
 *
 * @param connection - ABAP connection
 * @returns Axios response with trace directory information
 */
export async function getSt05TraceDirectory(
  connection: IAbapConnection,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/st05/trace/directory`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
    },
  });
}
