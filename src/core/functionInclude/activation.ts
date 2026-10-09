/**
 * FunctionInclude (FUGR/I) activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FUNCTION_INCLUDE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate function include.
 */
export async function activateFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${FUNCTION_INCLUDE.uri(groupName, includeName)}`;

  return await activateObjectInSession(
    connection,
    objectUri,
    includeName.toUpperCase(),
    true,
  );
}
