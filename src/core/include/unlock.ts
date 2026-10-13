/**
 * Include unlock.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { includeUrl } from './lock';

export async function unlockInclude(
  connection: IAbapConnection,
  includeName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: {},
  });
}
