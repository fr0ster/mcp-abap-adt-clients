/**
 * The query a metadata read carries: the version its caller names, then
 * `withLongPolling=true` when that is asked for — and nothing for neither, so
 * a read that names no version sends the request it always sent.
 *
 * The version is the caller's to name, never assumed. Measured on premise
 * (2026-11-01, read only): a class with an inactive version answered its
 * inactive document to a read with no version, to `inactive` and to
 * `workingArea`, and its active one only to `active`.
 */
import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import { buildQueryString } from '../../utils/internalUtils';

export function readQuery(
  version: AdtReadVersion | undefined,
  withLongPolling: boolean | undefined,
): string {
  const query = buildQueryString({
    version,
    withLongPolling: withLongPolling ? true : undefined,
  });
  return query ? `?${query}` : '';
}
