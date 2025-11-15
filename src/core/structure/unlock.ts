/**
 * Structure unlock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Unlock structure
 * Must use same session and lock handle from lock operation
 */
export async function unlockStructure(
  connection: AbapConnection,
  structureName: string,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return makeAdtRequestWithSession(connection, url, 'POST', sessionId, null);
}

