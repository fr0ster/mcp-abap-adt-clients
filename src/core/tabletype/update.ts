/**
 * TableType update operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { IUpdateTableTypeParams } from './types';

/**
 * Update table type using existing lock/session (Builder workflow)
 */
export async function updateTableType(
  connection: IAbapConnection,
  params: IUpdateTableTypeParams,
  lockHandle: string
): Promise<AxiosResponse> {
  if (!params.tabletype_name) {
    throw new Error('tabletype_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const tableTypeName = params.tabletype_name.toUpperCase();
  const queryParams = `lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
  const url = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({ url, method: 'PUT', timeout: getTimeout('default'), data: params.ddl_code, headers });
}
