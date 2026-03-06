/**
 * Behavior Implementation update operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Update behavior implementation class implementations include source code (low-level function)
 * Requires class to be locked first
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function updateBehaviorImplementation(
  connection: IAbapConnection,
  className: string,
  sourceCode: string,
  lockHandle: string,
  transportRequest?: string,
): Promise<AxiosResponse> {
  if (!sourceCode) {
    throw new Error('sourceCode is required');
  }

  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/implementations?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

  const headers = {
    'Content-Type': CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers,
  });
}
