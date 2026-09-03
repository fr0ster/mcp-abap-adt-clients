/**
 * Transport read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get ABAP transport request
 */
export async function getTransport(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(transportNumber);
  const url = `/sap/bc/adt/cts/transportrequests/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {},
  });
}
