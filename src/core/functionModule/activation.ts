/**
 * FunctionModule activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate function module
 */
export async function activateFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;

  return await activateObjectInSession(connection, objectUri, functionModuleName, true);
}

