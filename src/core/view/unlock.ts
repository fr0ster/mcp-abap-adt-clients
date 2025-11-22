/**
 * View unlock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock DDLS
 */
export async function unlockDDLS(
  connection: AbapConnection,
  viewName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({url, method: 'POST', timeout: getTimeout('default'), data: null});
}

