/**
 * Transport read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSPORT_REQUEST } from '../../endpoints/objects';

/**
 * Get ABAP transport request
 */
export async function getTransport(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  const url = `${TRANSPORT_REQUEST.uri(transportNumber)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {},
  });
}
