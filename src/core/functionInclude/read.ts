/**
 * FunctionInclude (FUGR/I) read operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FUNCTION_INCLUDE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export interface IReadOptions {
  withLongPolling?: boolean;
}

/**
 * Read a function include (metadata only, no source).
 */
export async function readFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version: 'active' | 'inactive' = 'active',
  _options?: IReadOptions,
): Promise<AxiosResponse> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }

  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const params = new URLSearchParams();
  params.append('version', version);
  if (_options?.withLongPolling) {
    params.append('withLongPolling', 'true');
  }
  const url = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}?${params.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_FUNCTION_INCLUDE,
    },
  });
}
