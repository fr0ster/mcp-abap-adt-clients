/**
 * Transport list operations — the low level.
 *
 * One request per function, always. Resolving which saved search to run is the
 * high level's job (`AdtRequest`), because it needs a response to do it and
 * that is precisely what a batch connection cannot supply mid-recording.
 */

import { TRANSPORT_SEARCH_CONFIGURATIONS_URL } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_TRANSPORT_CONFIGURATIONS,
  ACCEPT_TRANSPORT_LIST,
} from '../../constants/contentTypes';
import { TRANSPORT_REQUEST } from '../../endpoints/objects';
import type { ListTransportsParams } from './types';

/** The query string: exactly the parameters given, each value encoded. */
function listQuery(params: ListTransportsParams): string {
  if (params.configUri !== undefined) {
    return `configUri=${encodeURIComponent(params.configUri)}`;
  }
  const pairs: Array<readonly [string, string]> = [
    ['user', params.user],
    ['requestStatus', params.requestStatus.join('')],
  ];
  if (params.requestType !== undefined) {
    pairs.push(['requestType', params.requestType.join('')]);
  }
  if (params.targets === true) pairs.push(['targets', 'true']);
  if (params.releasedFromDate !== undefined) {
    pairs.push(['releasedFromDate', params.releasedFromDate]);
  }
  if (params.releasedToDate !== undefined) {
    pairs.push(['releasedToDate', params.releasedToDate]);
  }
  return pairs
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * List ABAP transport requests: one `GET /sap/bc/adt/cts/transportrequests`.
 *
 * Two forms of the one endpoint: a saved search's `configUri`, used verbatim,
 * or the query by user (`IListTransportsQuery`). Exactly the parameters given
 * are sent; the library adds no default.
 */
export async function listTransports(
  connection: IAbapConnection,
  params: ListTransportsParams,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TRANSPORT_REQUEST.collection}?${listQuery(params)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_TRANSPORT_LIST },
  });
}

/**
 * The saved transport searches this system holds. One request, unread.
 *
 * Separate from the parse below so the answer can reach a caller's own
 * `analyse` before anything is made of it — `AdtRequest.searchConfigurations()`
 * hands this to `answering()`, the same way every other member's low level is
 * handed over. Without it the only way to this endpoint was a member that had
 * already decided what the answer meant.
 *
 * Without this exact `Accept` the endpoint answers **406**.
 */
export async function requestTransportSearchConfigurations(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: TRANSPORT_SEARCH_CONFIGURATIONS_URL,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_TRANSPORT_CONFIGURATIONS },
  });
}
