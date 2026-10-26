/**
 * FunctionModule activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate function module
 */
export async function activateFunctionModule(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  functionGroupName: string,
  functionModuleName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${FUNCTION_MODULE.uri(functionGroupName, functionModuleName)}`;

  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    functionModuleName,
    true,
  );
}
