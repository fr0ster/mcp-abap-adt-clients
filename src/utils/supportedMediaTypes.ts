/**
 * The media types a refusal names, read from the error it came as.
 *
 * Pure functions over an error: nothing here sends, retries or remembers
 * anything. Until 36.0.0 this module also held accept negotiation — a retry of
 * a `406`/`415` with the type SAP named, and per-connection caches that put
 * that type on later requests. It is gone: a member sends the request it was
 * given, `options.headers` included, and what SAP answers is the call's
 * answer. A consumer that corrects a request itself reads the types here and
 * sends the request again with the `headers` it chooses.
 */

import type { HttpError } from '@mcp-abap-adt/interfaces-network';

/**
 * The text SAP's 406 puts before the types it accepts.
 *
 * Measured on an on-premise system: SAP answers a 406 with its exception
 * document, whose message reads "The message content is not acceptable.
 * Accepted content types: …" — the list is often empty — and no header names
 * the types. Only that list is read. A scan of the whole body for anything
 * shaped like `a/b` used to return two fragments of the document's namespace
 * URI (`www.sap.com/abapxml`, `types/communicationframework`) on every 406.
 */
const ACCEPTED_CONTENT_TYPES = 'Accepted content types:';

/** Where the list after the marker ends: the element, an attribute or the line. */
const LIST_ENDS = ['<', '"', '\n'];

export function extractSupportedAccept(error: unknown): string[] {
  const e = error as HttpError;
  const data = e?.response?.data;
  const text =
    typeof data === 'string' ? data : data ? JSON.stringify(data) : '';

  const types = new Set<string>();
  let at = text.indexOf(ACCEPTED_CONTENT_TYPES);
  while (at !== -1) {
    const start = at + ACCEPTED_CONTENT_TYPES.length;
    let end = text.length;
    for (const stop of LIST_ENDS) {
      const found = text.indexOf(stop, start);
      if (found !== -1 && found < end) end = found;
    }
    for (const entry of text.slice(start, end).split(',')) {
      const type = entry.trim();
      if (type) types.add(type);
    }
    at = text.indexOf(ACCEPTED_CONTENT_TYPES, end);
  }
  return Array.from(types);
}

export function extractSupportedContentType(error: unknown): string[] {
  const e = error as HttpError;
  if (e?.response?.status !== 415) {
    return [];
  }

  const types = new Set<string>();
  const headers = (e?.response?.headers || {}) as Record<string, unknown>;
  const headerCandidates = [
    headers['content-type'],
    headers['x-sap-adt-supported-content-type'],
    headers['supported-content-type'],
  ];

  for (const value of headerCandidates) {
    if (typeof value === 'string') {
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
          types.add(entry);
        });
    }
  }

  const data = e?.response?.data;
  const text =
    typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
  if (text) {
    const matches =
      text.match(/[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+(?:;[^,\s]+)?/g) || [];
    for (const match of matches) {
      types.add(match);
    }
  }

  return Array.from(types).filter(Boolean);
}
