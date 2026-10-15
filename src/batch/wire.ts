import { randomUUID } from 'node:crypto';
import type {
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';

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
  const params = request.params
    ? new URLSearchParams(request.params as Record<string, string>).toString()
    : '';
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
    const split = /\r?\n\r?\n/.exec(rest);
    if (!split || split.index === undefined)
      throw new Error(
        'Invalid ADT batch response: missing inner header terminator',
      );
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
      data: rest.slice(split.index + split[0].length),
    };
  });
}
