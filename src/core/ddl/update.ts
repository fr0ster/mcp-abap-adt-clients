/**
 * View update operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DDL_SOURCE, sourceUri } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Update view DDL source code
 * Low-level: Only uploads DDL source with lock handle, does NOT lock/unlock/activate
 * For complete workflow, use AdtDdl
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateDdl(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ddlName: string,
  ddlSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(DDL_SOURCE.uri(ddlName))}${writeQuery(lockHandle, transportRequest)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: ddlSource,
    headers: requestHeaders(headers),
  });
}
