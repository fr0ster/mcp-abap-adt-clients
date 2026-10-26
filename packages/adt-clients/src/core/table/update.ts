/**
 * Table update operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { sourceUri, TABLE } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateTableParams } from './types';

/**
 * Update table using existing lock/session (Builder workflow)
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateTable(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IUpdateTableParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const tableName = params.table_name.toUpperCase();
  const url = `${sourceUri(TABLE.uri(tableName))}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: params.ddl_code,
    headers: requestHeaders(headers),
  });
}
