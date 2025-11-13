/**
 * Interface read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP interface
 */
export async function getInterface(connection: AbapConnection, interfaceName: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(interfaceName);
  const url = `${baseUrl}/sap/bc/adt/oo/interfaces/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

