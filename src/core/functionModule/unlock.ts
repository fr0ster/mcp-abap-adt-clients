/**
 * FunctionModule unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock function module
 */
export async function unlockFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();
  const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=UNLOCK&lockHandle=${lockHandle}`;

  const headers = {
    'Accept': 'application/xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers
  });
}

