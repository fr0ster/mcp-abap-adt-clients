/**
 * Transport read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP transport request
 */
export async function getTransport(connection: AbapConnection, transportNumber: string): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(transportNumber);
  const url = `/sap/bc/adt/cts/transportrequests/${encodedName}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

