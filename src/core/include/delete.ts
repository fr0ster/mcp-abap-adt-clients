/**
 * Include delete — requires a lock, like every other ADT deletion.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { includeUrl } from './lock';

export async function deleteInclude(
  connection: IAbapConnection,
  includeName: string,
  lockHandle: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const query = `lockHandle=${encodeURIComponent(lockHandle)}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;

  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}?${query}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
    headers: {},
  });
}
