/**
 * Transport read operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP transport request
 */
export async function getTransport(connection: IAbapConnection, transportNumber: string): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(transportNumber);
  const url = `/sap/bc/adt/cts/transportrequests/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

