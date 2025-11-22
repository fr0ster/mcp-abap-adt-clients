/**
 * View update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '@mcp-abap-adt/connection';
import { UpdateViewSourceParams } from './types';

/**
 * Update view DDL source code
 * Low-level: Only uploads DDL source with lock handle, does NOT lock/unlock/activate
 * For complete workflow, use ViewBuilder
 */
export async function updateView(
  connection: AbapConnection,
  viewName: string,
  ddlSource: string,
  lockHandle: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({ url, method: 'PUT', timeout: getTimeout(), data: ddlSource, headers });
}

