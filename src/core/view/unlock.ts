/**
 * View unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock DDLS
 */
export async function unlockDDLS(
  connection: AbapConnection,
  viewName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}

