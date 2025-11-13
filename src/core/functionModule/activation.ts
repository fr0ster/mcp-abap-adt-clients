/**
 * FunctionModule activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate function module
 */
export async function activateFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  sessionId: string
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;

  return await activateObjectInSession(connection, objectUri, functionModuleName, sessionId, true);
}

