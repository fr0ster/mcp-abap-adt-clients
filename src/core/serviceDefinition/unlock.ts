/**
 * ServiceDefinition unlock operations
 * NOTE: Caller should call connection.setSessionType("stateless") after unlocking
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SERVICE_DEFINITION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock service definition
 * Must use same session and lock handle from lock operation
 */
export async function unlockServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${SERVICE_DEFINITION.uri(serviceDefinitionName.toLowerCase())}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
