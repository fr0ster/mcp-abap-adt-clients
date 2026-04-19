/**
 * FunctionInclude (FUGR/I) activation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate function include.
 */
export async function activateFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
): Promise<AxiosResponse> {
  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const objectUri = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;

  return await activateObjectInSession(
    connection,
    objectUri,
    includeName.toUpperCase(),
    true,
  );
}
