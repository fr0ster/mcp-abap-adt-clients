/**
 * Enhancement activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * Activate enhancement
 * Makes enhancement active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Axios response with activation result
 */
export async function activateEnhancement(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  const objectUri = getEnhancementUri(enhancementType, encodedName);

  return await activateObjectInSession(
    connection,
    objectUri,
    enhancementName.toUpperCase(),
    true,
  );
}
