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

import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: true,
});

/**
 * Thrown when the library could not read the answer.
 *
 * Distinct from a refusal, and distinct from nothing. Three outcomes have to
 * stay apart, and until this existed two of them looked identical:
 *
 * | the answer | what the caller must be told |
 * |---|---|
 * | an empty document | usually nothing matched — a result, unless the endpoint answers empty for "no such thing" |
 * | a refusal | the server said no — an error |
 * | something unreadable | *we* could not read it — an error, a different one |
 *
 * The third was reported as the first. A logon page — what an expired session
 * answers with — parsed to no nodes and went back as "the package is empty".
 *
 * The distinction matters because the error method on a result contract must be
 * empty only when there really is no error, never because a parser gave up. A
 * caller cannot act on a failure they were told did not happen.
 *
 * This is not the library judging the server's document. It is the library
 * saying what it did: it was handed something it does not know how to read, and
 * hands it back rather than inventing an answer from it.
 */
export class AdtParseError extends Error {
  /** The document exactly as it arrived. */
  readonly document: string;
  /** What was looked for and not found, e.g. `asx:abap/asx:values/DATA`. */
  readonly expected: string;

  constructor(expected: string, document: string, because?: string) {
    super(
      `The answer could not be read: expected ${expected}. ` +
        (because ??
          'It is not empty and it is not an ADT exception — see `document`.'),
    );
    this.name = 'AdtParseError';
    this.document = document;
    this.expected = expected;
  }
}

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
/**
 * SAP refused, and this is what it said.
 *
 * Named for where the failure came from, not for the document it arrived in: a
 * caller catching this needs to know the server said no, and `AdtExceptionDocument…`
 * described the mechanism instead of the fact.
 */
export class AdtSAPError extends Error {
  /** The document exactly as the server sent it. Nothing is summarised away. */
  readonly document: string;
  /** `<type id="…">`, when the document names one — the server's own classification. */
  readonly adtType?: string;
  /** `<namespace id="…">`, when the document names one. */
  readonly namespace?: string;
  /** The response it arrived on. A 2xx, or this would have thrown lower down. */
  readonly response?: IAdtWireResponse;
  /** The call that produced it, so a chain's steps can be told apart. */
  readonly request?: IAdtRefusalRequest;

  constructor(
    message: string,
    document: string,
    adtType?: string,
    namespace?: string,
    response?: IAdtWireResponse,
    request?: IAdtRefusalRequest,
  ) {
    super(message);
    this.name = 'AdtSAPError';
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
export function sapErrorIn(
  xmlData: string,
  context?: { response?: IAdtWireResponse; request?: IAdtRefusalRequest },
): AdtSAPError | undefined {
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

  return new AdtSAPError(
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
export function throwIfSapError(xmlData: string): void {
  const refusal = sapErrorIn(xmlData);
  if (refusal) {
    throw refusal;
  }
}

/**
 * The transport list has no saved configuration to run.
 *
 * Lives here rather than in `@mcp-abap-adt/interfaces` because it is a class: a
 * contract says what a thing is, a class is one way of being it, and shipping
 * one from the contracts package makes "swap in your own implementation" untrue
 * for that piece.

 * It survives the move where `AdtOperationError` does not, and the difference is
 * what each carries. This names one condition, says what to do about it, and
 * hands over the `endpoint` a caller needs to act — a failure worth
 * distinguishing. `AdtOperationError` named "an operation failed" and carried two
 * `unknown` fields.
 */
export class TransportSearchConfigurationMissing extends Error {
  constructor(public readonly endpoint: string) {
    super(
      'No transport search configuration exists on this system. The transport ' +
        'list is a saved-configuration search, so there is nothing to run: create ' +
        'a configuration in Eclipse, or pass configUri explicitly. Configurations ' +
        `live at ${endpoint}`,
    );
    this.name = 'TransportSearchConfigurationMissing';
  }
}

/**
 * An operation this library could not carry out, carrying ADT's own code.
 *
 * It left `@mcp-abap-adt/interfaces` in 29.0.0 with everything else that emits
 * code — a contract says what a thing is, a class is one way of being it. It is
 * kept for the few places that still **throw**: a caller error, or a condition
 * discovered before any request went out. Everything a server said comes back
 * as a returned failure instead, where `code` is `IAdtError.code`.
 */
export class AdtOperationError extends Error {
  /** ADT error code, e.g. `AdtObjectErrorCodes.UNSUPPORTED_OPERATION`. */
  code?: string;
  /** HTTP status, where one was involved. */
  status?: number;
  statusText?: string;
  /** Whatever was caught, kept for a caller that wants to look. */
  originalError?: unknown;

  constructor(message: string) {
    super(message);
    this.name = 'AdtOperationError';
  }
}
