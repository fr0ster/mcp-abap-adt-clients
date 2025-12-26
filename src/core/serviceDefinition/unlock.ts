/**
 * ServiceDefinition unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock service definition
 * Must use same session and lock handle from lock operation
 */
export async function unlockServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(
    serviceDefinitionName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}?_action=UNLOCK&lockHandle=${lockHandle}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
