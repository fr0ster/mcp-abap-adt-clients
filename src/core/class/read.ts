/**
 * Class read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP class source code
 */
export async function getClass(connection: AbapConnection, className: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(className);
  const url = `${baseUrl}/sap/bc/adt/oo/classes/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

