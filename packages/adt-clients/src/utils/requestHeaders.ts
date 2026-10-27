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
