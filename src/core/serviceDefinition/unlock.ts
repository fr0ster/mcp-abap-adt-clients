/**
 * ServiceDefinition unlock operations
 * NOTE: Builder should call connection.setSessionType("stateless") after unlocking
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Unlock service definition
 * Must use same session and lock handle from lock operation
 */
export async function unlockServiceDefinition(
  connection: AbapConnection,
  serviceDefinitionName: string,
  lockHandle: string
): Promise<AxiosResponse> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(serviceDefinitionName.toLowerCase());
  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default')
  });
}

