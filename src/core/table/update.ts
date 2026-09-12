/**
 * Table update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
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
  params: IUpdateTableParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const tableName = params.table_name.toUpperCase();
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName).toLowerCase()}/source/main${writeQuery(lockHandle, params.transport_request)}`;

  const headers = {
    'Content-Type': CT_SOURCE,
    Accept: ACCEPT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: params.ddl_code,
    headers,
  });
}
