/**
 * View read operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ABAP view (CDS or Classic)
 */
export async function getView(connection: AbapConnection, viewName: string): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const encodedName = encodeSapObjectName(viewName);
  const url = `${baseUrl}/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

