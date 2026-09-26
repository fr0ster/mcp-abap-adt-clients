/**
 * Transport list operations — the low level.
 *
 * One request per function, always. Resolving which saved search to run is the
 * high level's job (`AdtRequest`), because it needs a response to do it and
 * that is precisely what a batch connection cannot supply mid-recording.
 */

import type { IListTransportsParams } from '@mcp-abap-adt/interfaces-adt';
import { TRANSPORT_SEARCH_CONFIGURATIONS_URL } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_TRANSPORT_CONFIGURATIONS,
  ACCEPT_TRANSPORT_LIST,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * List ABAP transport requests for a saved search.
 *
 * `configUri` is required and is used verbatim. Sending filter parameters
 * instead returns an empty root — the search must be referenced, not restated.
 */
export async function listTransports(
  connection: IAbapConnection,
  params: IListTransportsParams,
): Promise<IAdtWireResponse> {
  if (!params.configUri) {
    throw new Error(
      'listTransports requires configUri: the transport list is a saved-configuration ' +
        `search. Obtain an href from ${TRANSPORT_SEARCH_CONFIGURATIONS_URL}`,
    );
  }

  const url = `/sap/bc/adt/cts/transportrequests?configUri=${encodeURIComponent(
    params.configUri,
  )}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT_CONFIGURATIONS },
  });
}
