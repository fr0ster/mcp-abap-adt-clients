/**
 * View update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

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
  ddlName: string,
  ddlSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(ddlName).toLowerCase()}/source/main${writeQuery(lockHandle, transportRequest)}`;

  const headers = {
    'Content-Type': CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout(),
    data: ddlSource,
    headers,
  });
}
