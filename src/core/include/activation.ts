/**
 * Include activation.
 *
 * The generic `/sap/bc/adt/activation` endpoint with the include addressed by
 * URI — measured, there is nothing include-specific about it.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { includeUrl } from './lock';

export async function activateInclude(
  connection: IAbapConnection,
  includeName: string,
): Promise<IAdtWireResponse> {
  return activateObjectInSession(
    connection,
    includeUrl(includeName),
    includeName,
    true,
  );
}
