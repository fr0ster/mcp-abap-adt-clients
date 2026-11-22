/**
 * GatewayErrorLog - Low-level read functions
 *
 * Provides access to SAP Gateway error log (/IWFND/ERROR_LOG):
 * - List gateway errors with optional filtering
 * - Get individual error details by type and ID
 */

import type { IFeedQueryOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { buildFeedQueryParams } from '../feeds/read';

/**
 * List gateway errors
 *
 * @param connection - ABAP connection
 * @param options - Query options
 * @returns Axios response with gateway error log feed
 */
export async function listGatewayErrors(
  connection: IAbapConnection,
  options?: IFeedQueryOptions,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/gw/errorlog${buildFeedQueryParams(options, 'username')}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

/**
 * Get a single gateway error: `/gw/errorlog/{kind}/{opid}`.
 *
 * `/IWBEP/CL_ERROR_LOG_VIEWER->get` (l. 26, read on premise and on the
 * cloud) looks the error up by its OPID (l. 59/73) — not by its transaction
 * id — and reads the Backend log when the kind is `BackendError` on premise
 * and `Backend Error` on the cloud (l. 57), the hub log for any other. The
 * answer is HTML, its type negotiated against `text/html` alone (onprem
 * l. 89-93, cloud l. 93-97), so that is what is asked for (it was
 * `application/xml` until 47.0.0). An unknown OPID answers `200` with an
 * empty error, not `404` (code).
 *
 * @param connection - ABAP connection
 * @param errorType - The kind, as this system's viewer takes it: an entry's
 *   `detailUri` (adt-strategies `feedGatewayErrors`) carries the right one
 * @param errorId - The error's OPID (an entry's `opid`), not its transaction id
 * @returns The error's HTML document
 */
export async function getGatewayError(
  connection: IAbapConnection,
  errorType: string,
  errorId: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/gw/errorlog/${encodeURIComponent(errorType)}/${errorId}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: 'text/html',
    },
  });
}
