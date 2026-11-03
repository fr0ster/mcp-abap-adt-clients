/**
 * ATC results by Display ID: the list of results SAP holds, and one result.
 *
 * Measured on premise and on the cloud (2026-11-02). Both answer
 * `application/xml`, an `atcresult:resultList`: the list carries no objects,
 * one result carries its objects and their findings in the worklist's shape.
 * See `docs/superpowers/2026-11-02-atc-results-spec.md` in mcp-abap-adt for
 * the measured table.
 */

import type { IAtcResultListOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_ATC_RESULTS } from '../../constants/contentTypes';

const RESULTS = '/sap/bc/adt/atc/results';

/**
 * The results whose creator is `createdBy` — `GET /atc/results`.
 *
 * Only the parameters given are sent. `centralOnly: true` sends
 * `centralResult=true` (central results only); without it the list holds
 * every kind. Without ages SAP applies a window of its own. `createdBy` is
 * `*` for every user; a kind without it matches nobody, and no parameter at
 * all is a `400` (SADT_RESOURCE 017).
 */
export async function listAtcResults(
  connection: IAbapConnection,
  options: IAtcResultListOptions,
): Promise<IAdtWireResponse> {
  const query = new URLSearchParams({ createdBy: options.createdBy });
  if (options.centralOnly === true) query.set('centralResult', 'true');
  if (options.ageMin !== undefined) query.set('ageMin', String(options.ageMin));
  if (options.ageMax !== undefined) query.set('ageMax', String(options.ageMax));
  return connection.makeAdtRequest({
    url: `${RESULTS}?${query}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ATC_RESULTS },
  });
}

/**
 * One result by its Display ID — `GET /atc/results/{displayId}`.
 *
 * The same `resultList`, holding one `result` with its `objects` and their
 * findings. An unknown Display ID is `404 ExceptionResourceNotFound`.
 */
export async function getAtcResult(
  connection: IAbapConnection,
  displayId: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${RESULTS}/${encodeURIComponent(displayId)}`,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ATC_RESULTS },
  });
}
