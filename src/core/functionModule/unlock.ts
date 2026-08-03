/**
 * FunctionModule unlock operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock function module
 */
export async function unlockFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName =
    encodeSapObjectName(functionModuleName).toLowerCase();
  const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

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
