import { randomUUID } from 'node:crypto';
import type {
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';

/** The words a batch request with params of another shape is refused in. */
export const BATCH_REFUSES_PARAMS =
  "a batch request's params must be a string, a URLSearchParams or a plain object of string, number or boolean values";

/**
 * A request's params as the query it adds, or `''` for none. Accepted, as the
 * owner decided (D4 of #304): a string, a `URLSearchParams`, or a plain object
 * (its prototype `Object.prototype` or `null`) whose values are strings,
 * numbers or booleans; anything else throws `BATCH_REFUSES_PARAMS`. An
 * accepted value gives the query `new URLSearchParams(params)` gave.
 */
export function batchQuery(params: unknown): URLSearchParams {
  if (params === undefined || params === null || params === '')
    return new URLSearchParams();
  if (typeof params === 'string' || params instanceof URLSearchParams)
    return new URLSearchParams(params);
  if (typeof params === 'object') {
    const prototype: object | null = Object.getPrototypeOf(params);
    if (prototype === Object.prototype || prototype === null) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        const entry: unknown = value;
        if (
          typeof entry !== 'string' &&
          typeof entry !== 'number' &&
          typeof entry !== 'boolean'
        )
          throw new Error(BATCH_REFUSES_PARAMS);
        query.append(key, String(entry));
      }
      return query;
    }
  }
  throw new Error(BATCH_REFUSES_PARAMS);
}

export const createBatchBoundary = (): string => `batch_${randomUUID()}`;
export const createRequestId = (): string => randomUUID().replace(/-/g, '');

export function buildBatchPayload(
  requests: readonly string[],
  boundary = createBatchBoundary(),
): { boundary: string; body: string } {
  return {
    boundary,
    body:
      requests
        .map(
          (request) =>
            `--${boundary}\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\n${request}`,
        )
        .join('') + `\r\n--${boundary}--\r\n`,
  };
}

export function innerRequest(request: IAbapRequestOptions): string {
  const headers = { ...request.headers };
  // `data: null` is how a member says "no body" (lock, unlock): it must not
  // become the four characters "null". Sent that way, every PUT under those
  // locks was refused 423 "invalid lock handle" (on an on-premise system, 2026-10-16).
  const hasBody = request.data !== undefined && request.data !== null;
  const body = hasBody ? String(request.data) : '';
  if (hasBody) {
    for (const key of Object.keys(headers))
      if (key.toLowerCase() === 'content-length') delete headers[key];
    headers['Content-Length'] = String(Buffer.byteLength(body));
  }
  const params = request.params ? batchQuery(request.params).toString() : '';
  const url =
    request.url +
    (params ? `${request.url.includes('?') ? '&' : '?'}${params}` : '');
  return `${request.method} ${url} HTTP/1.1\r\n${Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}\r\n`)
    .join('')}\r\n${body}\r\n`;
}

export function parseBatchResponse(
  response: IAdtWireResponse,
): IAdtWireResponse[] {
  const contentType = Object.entries(response.headers).find(
    ([key]) => key.toLowerCase() === 'content-type',
  )?.[1];
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(
    String(contentType),
  );
  if (!boundary)
    throw new Error('Invalid ADT batch response: missing multipart boundary');
  const escaped = (boundary[1] ?? boundary[2]).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  // Only complete delimiter lines count; boundary-like body text is payload.
  const delimiter = new RegExp(
    `(?:^|\\r?\\n)--${escaped}(--)?[ \t]*(?:\\r?\\n|$)`,
    'g',
  );
  const body = String(response.data);
  const chunks: string[] = [];
  let start: number | undefined;
  for (const match of body.matchAll(delimiter)) {
    if (start !== undefined) chunks.push(body.slice(start, match.index));
    if (match[1]) break;
    start = match.index + match[0].length;
  }
  return chunks.map((part) => {
    const match = /(?:^|\r?\n)HTTP\/1\.\d\s+(\d{3})\s*([^\r\n]*)\r?\n/.exec(
      part,
    );
    if (!match || match.index === undefined)
      throw new Error('Invalid ADT batch response: missing inner HTTP status');
    const rest = part.slice(match.index + match[0].length);
    // A bodyless answer (an UNLOCK's 200) ends right after its headers: the
    // empty line's last CRLF belongs to the next delimiter (RFC 2046), so the
    // part holds one line break, not two. Headers then run to the end.
    // Immediately after the status line, one blank line means no headers.
    const found = /^(?:\r?\n)|\r?\n\r?\n/.exec(rest);
    const split =
      found && found.index !== undefined
        ? { index: found.index, length: found[0].length }
        : { index: rest.length, length: 0 };
    const headers: Record<string, string> = {};
    for (const line of rest.slice(0, split.index).split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon > 0)
        headers[line.slice(0, colon).toLowerCase()] = line
          .slice(colon + 1)
          .trim();
    }
    return {
      status: Number(match[1]),
      statusText: match[2].trim(),
      headers,
      data: rest.slice(split.index + split.length),
    };
  });
}
