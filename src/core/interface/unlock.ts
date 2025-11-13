/**
 * Interface unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock interface
 * Must use same session and lock handle from lock operation
 */
export async function unlockInterface(
  connection: AbapConnection,
  interfaceName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName)}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(
    connection,
    url,
    'POST',
    sessionId,
    '',
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
}

