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

/**
 * The text SAP's 415 puts before the types it accepts as a body.
 *
 * Measured on an on-premise system: SAP answers a 415 with its exception
 * document (`content-type: application/xml`, the document's own type), whose
 * message reads "Unsupported Media Type. Supported Media Types: …" — or a bare
 * "Unsupported Media Type". Only that list is read. Until 36.0.0 the parser
 * also read the response's headers and every `type/subtype` in the body, so it
 * answered `application/xml` and two fragments of the document's namespace URI
 * before the type SAP named.
 */
const SUPPORTED_MEDIA_TYPES = 'Supported Media Types:';

/** Where the list after the marker ends: the element, an attribute or the line. */
const LIST_ENDS = ['<', '"', '\n'];

/** The body of a refusal as text. */
function bodyText(error: unknown): string {
  const data = (error as HttpError)?.response?.data;
  return typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
}

/** Every type listed after `marker` in `text`, in order, each once. */
function listedAfter(text: string, marker: string): string[] {
  const types = new Set<string>();
  let at = text.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    let end = text.length;
    for (const stop of LIST_ENDS) {
      const found = text.indexOf(stop, start);
      if (found !== -1 && found < end) end = found;
    }
    for (const entry of text.slice(start, end).split(',')) {
      const type = entry.trim();
      if (type) types.add(type);
    }
    at = text.indexOf(marker, end);
  }
  return Array.from(types);
}

export function extractSupportedAccept(error: unknown): string[] {
  return listedAfter(bodyText(error), ACCEPTED_CONTENT_TYPES);
}

export function extractSupportedContentType(error: unknown): string[] {
  if ((error as HttpError)?.response?.status !== 415) {
    return [];
  }
  return listedAfter(bodyText(error), SUPPORTED_MEDIA_TYPES);
}
