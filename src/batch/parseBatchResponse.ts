import type { IBatchResponsePart } from './types';

export function extractBoundary(contentType: string): string {
  const match = contentType.match(/boundary=([^;]+)/);
  if (!match) {
    throw new Error(
      `Cannot extract boundary from content-type: ${contentType}`,
    );
  }
  return match[1].trim();
}

export function parseBatchResponse(
  rawBody: string,
  contentType: string,
): IBatchResponsePart[] {
  const boundary = extractBoundary(contentType);
  const parts = rawBody
    .split(`--${boundary}`)
    .filter((p) => p.trim() && !p.trim().startsWith('--'));

  return parts.map((part) => parseSinglePart(part));
}

function parseSinglePart(raw: string): IBatchResponsePart {
  // Skip the MIME envelope headers (Content-Type: application/http, etc.)
  // and find the inner HTTP response which starts with HTTP/1.1
  const httpStart = raw.indexOf('HTTP/1.1');
  if (httpStart === -1) {
    return { status: 0, statusText: 'Unparseable', headers: {}, data: raw };
  }

  const httpPart = raw.substring(httpStart);

  // Split into status-line + headers vs body at the first double CRLF
  const headerBodySplit = httpPart.indexOf('\r\n\r\n');
  const headerSection =
    headerBodySplit === -1 ? httpPart : httpPart.substring(0, headerBodySplit);
  const body =
    headerBodySplit === -1 ? '' : httpPart.substring(headerBodySplit + 4);

  const lines = headerSection.split('\r\n');
  const statusLine = lines[0];
  const statusMatch = statusLine.match(/^HTTP\/1\.1\s+(\d+)\s+(.*)/);
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : 0;
  const statusText = statusMatch ? statusMatch[2].trim() : '';

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx > 0) {
      const key = lines[i].substring(0, colonIdx).trim().toLowerCase();
      const value = lines[i].substring(colonIdx + 1).trim();
      headers[key] = value;
    }
  }

  return { status, statusText, headers, data: body.trim() };
}
