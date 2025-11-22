/**
 * Structure unlock operations
 * NOTE: Builder should call connection.setSessionType("stateless") after unlocking
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock structure
 * Must use same session and lock handle from lock operation
 */
export async function unlockStructure(
  connection: AbapConnection,
  structureName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName).toLowerCase()}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null
  });
}

