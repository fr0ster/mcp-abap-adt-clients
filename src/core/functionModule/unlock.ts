/**
 * FunctionModule unlock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock function module
 */
export async function unlockFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_MODULE.uri(functionGroupName, functionModuleName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  const headers = {
    Accept: 'application/xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });
}
