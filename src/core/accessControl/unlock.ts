import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCESS_CONTROL } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock access control
 * Must use same session and lock handle from lock operation
 */
export async function unlockAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const url = `${ACCESS_CONTROL.uri(accessControlName.toLowerCase())}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
