/**
 * Table update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { UpdateTableParams } from './types';

/**
 * Update table using existing lock/session (Builder workflow)
 */
export async function updateTable(
  connection: AbapConnection,
  params: UpdateTableParams,
  lockHandle: string
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('table_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const tableName = params.table_name.toUpperCase();
  const queryParams = `lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({url, method: 'PUT', timeout: getTimeout('default'), data: params.ddl_code, headers});
}

