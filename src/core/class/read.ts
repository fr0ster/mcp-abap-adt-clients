/**
 * Class read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP class source code
 * @param connection - SAP connection
 * @param className - Class name
 * @param version - 'active' (default) or 'inactive' to read modified but not activated version
 */
export async function getClass(
  connection: AbapConnection,
  className: string,
  version: 'active' | 'inactive' = 'active'
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(className);
  const versionParam = version === 'inactive' ? '?version=inactive' : '';
  const url = `${baseUrl}/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

