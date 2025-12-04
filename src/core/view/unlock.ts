/**
 * View unlock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock DDLS
 */
export async function unlockDDLS(
  connection: IAbapConnection,
  viewName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({url, method: 'POST', timeout: getTimeout('default'), data: null});
}

