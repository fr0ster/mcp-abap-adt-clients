/**
 * A request's own `Accept` and `Content-Type`, as its caller gave them.
 *
 * Since interfaces-adt 19.0.0 a member whose request sets both headers takes
 * them as `options.headers` and sends exactly that pair. This is the one place
 * the pair becomes the request's headers: nothing is merged in, defaulted or
 * replaced, so what the caller passed is what goes on the wire.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';

export function requestHeaders(headers: IAdtHeaders): {
  Accept: string;
  'Content-Type': string;
} {
  return { Accept: headers.accept, 'Content-Type': headers.contentType };
}

/**
 * An update's headers: the caller's pair, and `If-Match` when the caller gave
 * `ifMatch` (interfaces-adt 25.2.0, `IAdtUpdateOptions`).
 *
 * The one place `If-Match` is built. Every update that writes a document
 * sends its write with these headers, so the header is there exactly when
 * `ifMatch` is given, with the value as given, and absent otherwise — the
 * write is then the one it was before. No read and no create builds its
 * headers here. What the value means is SAP's: it compares it with the ETag of
 * the newest version of the document and refuses the write (`412`) when they
 * differ (measured on premise and on the cloud, 2026-11-03).
 */
export function updateRequestHeaders(
  headers: IAdtHeaders,
  ifMatch: string | undefined,
): {
  Accept: string;
  'Content-Type': string;
  'If-Match'?: string;
} {
  const pair = requestHeaders(headers);
  return ifMatch === undefined ? pair : { ...pair, 'If-Match': ifMatch };
}
