/**
 * DDIC Activation Graph Logs
 * 
 * Provides functions for reading DDIC activation dependency graph with logs:
 * - Get activation graph
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';

/**
 * Get activation graph options
 */
export interface IGetActivationGraphOptions {
  objectName?: string;
  objectType?: string;
  logName?: string;
}

/**
 * Get DDIC activation graph with logs
 * 
 * @param connection - ABAP connection
 * @param options - Optional parameters
 * @returns Axios response with activation graph
 */
export async function getActivationGraph(
  connection: IAbapConnection,
  options?: IGetActivationGraphOptions
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/logs/activationgraph`;
  const params: Record<string, any> = {};
  
  if (options?.objectName) params.objectName = options.objectName;
  if (options?.objectType) params.objectType = options.objectType;
  if (options?.logName) params.logName = options.logName;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      'Accept': 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/categories/ddic/logs/activation/graph'
    }
  });
}

