/**
 * FunctionModule activation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate function module
 */
export async function activateFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
): Promise<AxiosResponse> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName =
    encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}`;

  return await activateObjectInSession(
    connection,
    objectUri,
    functionModuleName,
    true,
  );
}
