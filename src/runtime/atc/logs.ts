/**
 * ATC (ABAP Test Cockpit) Logs
 *
 * Provides functions for reading ATC check failure logs and execution logs:
 * - Get check failure logs
 * - Get execution log
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get check failure logs options
 */
export interface IGetCheckFailureLogsOptions {
  displayId?: string;
  objName?: string;
  objType?: string;
  moduleId?: string;
  phaseKey?: string;
}

/**
 * Get ATC check failure logs
 *
 * @param connection - ABAP connection
 * @param options - Optional filters
 * @returns Axios response with check failure logs
 */
export async function getCheckFailureLogs(
  connection: IAbapConnection,
  options?: IGetCheckFailureLogsOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/atc/checkfailures/logs`;
  const params: Record<string, any> = {};

  if (options?.displayId) params.displayId = options.displayId;
  if (options?.objName) params.objName = options.objName;
  if (options?.objType) params.objType = options.objType;
  if (options?.moduleId) params.moduleId = options.moduleId;
  if (options?.phaseKey) params.phaseKey = options.phaseKey;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/adt/atc/relations/checkfailures/logs',
    },
  });
}

/**
 * Get ATC execution log
 *
 * @param connection - ABAP connection
 * @param executionId - Execution ID
 * @returns Axios response with execution log
 */
export async function getExecutionLog(
  connection: IAbapConnection,
  executionId: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/atc/results/${executionId}/log`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation': 'http://www.sap.com/adt/atc/relations/results/log',
    },
  });
}
