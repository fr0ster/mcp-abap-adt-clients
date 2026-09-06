/**
 * Include delete — requires a lock, like every other ADT deletion.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { includeUrl } from './lock';

export async function deleteInclude(
  connection: IAbapConnection,
  includeName: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}${writeQuery(lockHandle, transportRequest)}`,
    method: 'DELETE',
    timeout: getTimeout('default'),
    headers: {},
  });
}
