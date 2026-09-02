/**
 * An ADT refusal that arrived with a success status.
 *
 * ADT does not always answer a refusal with a 4xx. `SADT_REST_RFC_ENDPOINT` on
 * legacy systems returns 200 with an empty status line, and several resources
 * answer 200 carrying `<exc:exception>` — the document says "does not exist" or
 * "not authorised" while the transport says the request succeeded, so nothing
 * below throws.
 *
 * That is harmless while a caller receives the document. It stops being harmless
 * the moment a parser stands between them: a parser that finds no nodes in an
 * exception document returns an empty result, and the caller reads "nothing
 * found" where the server said "no". The message, the type and the whole
 * document are gone, and there is no status to give it away.
 *
 * So parsing a document that is a refusal throws instead — carrying the server's
 * own message and the document unchanged, so the caller loses nothing they would
 * have had before the parse.
 *
 * This is not the library judging the server's documents, which it does not do.
 * It is the library declining to translate a refusal into a fact.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
});

/** What the library asked for, when a refusal came back. */
export interface IAdtRefusalRequest {
  method?: string;
  url?: string;
}

/**
 * Thrown when a response turns out to be a refusal.
 *
 * Carries enough for a consumer to do their own analysis and decide what to do,
 * because this library does not decide for them: what the server said, the
 * document it said it in, the classification the server itself gave, the
 * response it arrived on, and the request that produced it.
 *
 * The last one is why this is not just the document. A refusal with no request
 * beside it tells a caller that something was refused, and leaves them to guess
 * which of the several calls in a chain it was — `delete()` issues a check and a
 * delete, `create()` runs validate, create, lock, update, unlock and activate.
 * "Object is locked" is a different problem depending on which of those asked.
 */
export class AdtExceptionDocumentError extends Error {
  /** The document exactly as the server sent it. Nothing is summarised away. */
  readonly document: string;
  /** `<type id="…">`, when the document names one — the server's own classification. */
  readonly adtType?: string;
  /** `<namespace id="…">`, when the document names one. */
  readonly namespace?: string;
  /** The response it arrived on. A 2xx, or this would have thrown lower down. */
  readonly response?: IAdtResponse;
  /** The call that produced it, so a chain's steps can be told apart. */
  readonly request?: IAdtRefusalRequest;

  constructor(
    message: string,
    document: string,
    adtType?: string,
    namespace?: string,
    response?: IAdtResponse,
    request?: IAdtRefusalRequest,
  ) {
    super(message);
    this.name = 'AdtExceptionDocumentError';
    this.document = document;
    this.adtType = adtType;
    this.namespace = namespace;
    this.response = response;
    this.request = request;
  }
}

const text = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const inner = record['#text'];
    if (typeof inner === 'string') {
      return inner;
    }
  }
  return undefined;
};

const attribute = (value: unknown, name: string): string | undefined => {
  if (value && typeof value === 'object') {
    const found = (value as Record<string, unknown>)[name];
    if (typeof found === 'string') {
      return found;
    }
  }
  return undefined;
};

/**
 * The refusal in this document, if it is one.
 *
 * Cheap string test first: an ADT document that is not an exception is the
 * common case, and re-parsing every payload to learn that would cost every read.
 */
export function adtExceptionIn(
  xmlData: string,
  context?: { response?: IAdtResponse; request?: IAdtRefusalRequest },
): AdtExceptionDocumentError | undefined {
  if (!xmlData || !xmlData.includes('<exc:exception')) {
    return undefined;
  }

  let message: string | undefined;
  let adtType: string | undefined;
  let namespace: string | undefined;
  try {
    const parsed = parser.parse(xmlData) as Record<string, unknown>;
    const exception = parsed['exc:exception'] as
      | Record<string, unknown>
      | undefined;
    if (exception) {
      message =
        text(exception.localizedMessage) ??
        text(exception.message) ??
        text(exception['exc:message']);
      adtType = attribute(exception.type, 'id');
      namespace = attribute(exception.namespace, 'id');
    }
  } catch {
    // The document announced itself as an exception and then would not parse.
    // Still a refusal; the caller gets the raw document and a generic message
    // rather than a silent empty result.
  }

  return new AdtExceptionDocumentError(
    message
      ? `SAP refused the request: ${message}`
      : 'SAP refused the request with an ADT exception document ' +
          '(no message element could be read; see `document`)',
    xmlData,
    adtType,
    namespace,
    context?.response,
    context?.request,
  );
}

/** Throws when the document is a refusal; returns otherwise. */
export function throwIfAdtException(xmlData: string): void {
  const refusal = adtExceptionIn(xmlData);
  if (refusal) {
    throw refusal;
  }
}
