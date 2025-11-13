/**
 * Class unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock class
 * Must use same session and lock handle from lock operation
 */
export async function unlockClass(
  connection: AbapConnection,
  className: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}

