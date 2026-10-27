/**
 * Include activation.
 *
 * The generic `/sap/bc/adt/activation` endpoint with the include addressed by
 * URI — measured, there is nothing include-specific about it.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { activateObjectInSession } from '../../utils/activationUtils';
import { includeUrl } from './lock';

export async function activateInclude(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  includeName: string,
): Promise<IAdtWireResponse> {
  return activateObjectInSession(
    connection,
    headers,
    includeUrl(includeName),
    includeName,
    true,
  );
}
