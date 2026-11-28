/**
 * Where a reference leads — `POST /sap/bc/adt/navigation/target?uri=…`.
 *
 * Measured on premise and on ABAP cloud (2026-11-28): an outline's name
 * fragment (`<include>/source/main#type=PROG%2FPU;name=…`) answers `200` with
 * an `adtcore:objectReference` whose `uri` is `<include>#start=line,column` —
 * the line of the element's statement, the column of its name. Several such
 * requests share one `/communication/batch` envelope on both systems, each
 * part answered as alone. A function group's local method's definition link is
 * refused on both (`400`, EU/061); a one-include program's answers a start on
 * premise. The start's include is the answer's: it may be another include of
 * the same object than the link's.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { NAVIGATION } from '../../endpoints/objects';
import { buildQueryString } from '../../utils/internalUtils';

/** The Accept the target answers by default (discovery lists `application/xml`). */
export const ACCEPT_NAVIGATION_TARGET = 'application/xml';

/** The template's parameters besides `uri`, and the Accept to send. */
export interface INavigationTargetRequest {
  filter?: string | undefined;
  fullname?: string | undefined;
  accept?: string | undefined;
}

/**
 * One request, no body. `uri` is the reference as given, encoded once as a
 * query value; `filter` and `fullname` only when given.
 */
export async function getNavigationTarget(
  connection: IAbapConnection,
  uri: string,
  options?: INavigationTargetRequest,
): Promise<IAdtWireResponse> {
  const query = buildQueryString({
    uri,
    filter: options?.filter,
    fullname: options?.fullname,
  });
  return connection.makeAdtRequest({
    url: `${NAVIGATION.target}?${query}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: options?.accept ?? ACCEPT_NAVIGATION_TARGET },
  });
}
