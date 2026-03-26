/**
 * Transport list operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT_LIST } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { IListTransportsParams } from './types';

/**
 * List ABAP transport requests
 *
 * Calls GET /sap/bc/adt/cts/transportrequests with query parameters.
 * Goes through standard connection.makeAdtRequest() so Accept negotiation works.
 */
export async function listTransports(
  connection: IAbapConnection,
  params: IListTransportsParams,
): Promise<IAdtResponse> {
  const query = new URLSearchParams({ user: params.user });
  if (params.status) query.append('status', params.status);
  if (params.date_range) query.append('dateRange', params.date_range);
  if (params.target_system) query.append('targetSystem', params.target_system);
  if (params.request_type) query.append('type', params.request_type);

  const url = `/sap/bc/adt/cts/transportrequests?${query.toString()}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT_LIST },
  });
}
