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
 */
export async function updateTable(
  connection: IAbapConnection,
  params: IUpdateTableParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  if (!params.table_name) {
    throw new Error('table_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }
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
