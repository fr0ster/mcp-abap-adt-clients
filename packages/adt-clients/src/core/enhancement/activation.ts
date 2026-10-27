/**
 * Enhancement activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { activateObjectInSession } from '../../utils/activationUtils';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * Activate enhancement
 * Makes enhancement active and usable in SAP system
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxhb, enhoxhh, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Axios response with activation result
 */
export async function activateEnhancement(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  enhancementType: EnhancementType,
  enhancementName: string,
): Promise<IAdtWireResponse> {
  const objectUri = getEnhancementUri(enhancementType, enhancementName);

  return await activateObjectInSession(
    connection,
    headers,
    objectUri,
    enhancementName.toUpperCase(),
    true,
  );
}
