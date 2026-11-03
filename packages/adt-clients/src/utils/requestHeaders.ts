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
 * What a guarded write does with the `charset` parameter of its
 * `Content-Type`: `'kept'`, or `'dropped'` — the write is then sent without
 * it, and only when `ifMatch` is given.
 *
 * `'dropped'` is the writer's statement that SAP builds its document's ETag
 * with the media type, and compares it with the write's `Content-Type`: the
 * object's own XML document (every metadata write, the message class message's
 * class document) and the DDIC sources (structure, table, append structure).
 * Measured on premise, 2026-11-03: a domain `PUT` of
 * `application/vnd.sap.adt.domains.v2+xml` with the read's ETag answered
 * `200`, the same with `; charset=utf-8` answered `412`; a structure source
 * read answered an ETag ending `text/plain2`, and a write with
 * `text/plain; charset=utf-8` was refused `412` where one with `text/plain`
 * was not. The XML declaration carries an XML document's encoding. Every
 * other source keeps its charset: its ETag carries no media type, and its
 * guarded write was measured passing with it (program, class, DDL).
 */
export type GuardedCharset = 'kept' | 'dropped';

/** `contentType` without its `charset` parameter; the rest as it is. */
function withoutCharset(contentType: string): string {
  return contentType
    .split(';')
    .filter(
      (part, index) =>
        index === 0 ||
        (part.split('=')[0] ?? '').trim().toLowerCase() !== 'charset',
    )
    .join(';');
}

/**
 * An update's headers: the caller's pair, and `If-Match` when the caller gave
 * `ifMatch` (interfaces-adt 25.2.0, `IAdtUpdateOptions`).
 *
 * The one place `If-Match` is built. Every update that writes a document
 * sends its write with these headers, so the header is there exactly when
 * `ifMatch` is given, with the value as given, and absent otherwise — the
 * write is then the one it was before, byte for byte. A guarded write drops
 * the `charset` of its `Content-Type` when its writer says `'dropped'`
 * ({@link GuardedCharset}). No read and no create builds its
 * headers here. What the value means is SAP's: it compares it with the ETag of
 * the newest version of the document and refuses the write (`412`) when they
 * differ (measured on premise and on the cloud, 2026-11-03).
 */
export function updateRequestHeaders(
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  charset: GuardedCharset,
): {
  Accept: string;
  'Content-Type': string;
  'If-Match'?: string;
} {
  const pair = requestHeaders(headers);
  if (ifMatch === undefined) return pair;
  return {
    ...pair,
    'Content-Type':
      charset === 'dropped'
        ? withoutCharset(headers.contentType)
        : headers.contentType,
    'If-Match': ifMatch,
  };
}
