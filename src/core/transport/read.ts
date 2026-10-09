/**
 * Transport read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TRANSPORT_REQUEST } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

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
    timeout: getTimeout('default'),
    headers: {},
  });
}
