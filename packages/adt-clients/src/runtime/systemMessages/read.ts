/**
 * SystemMessages - Low-level read functions
 *
 * Provides access to system messages (SM02): the collection, with optional
 * filtering. There is no read of one message by id: `CL_STSK_ADT_RES_APP->
 * register_resources` (l. 31-48, the same on premise and on the cloud)
 * registers `/runtime/systemmessages` alone, so `/{id}` has no handler; the
 * read that asked for it left in 47.0.0.
 */

import type { IFeedQueryOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { buildFeedQueryParams } from '../feeds/read';

/**
 * List system messages
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with system messages feed
 */
export async function listSystemMessages(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/runtime/systemmessages${buildFeedQueryParams(options)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}
