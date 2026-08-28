/**
 * Include unlock.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { includeUrl } from './lock';

export async function unlockInclude(
  connection: IAbapConnection,
  includeName: string,
  lockHandle: string,
): Promise<IAdtResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: {},
  });
}
