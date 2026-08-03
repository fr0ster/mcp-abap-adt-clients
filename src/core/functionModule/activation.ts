/**
 * FunctionModule activation operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate function module
 */
export async function activateFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
): Promise<IAdtResponse> {
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
