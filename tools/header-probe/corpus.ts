/**
 * The error corpus's pure parts: the authorization verdict, the discovery
 * document's collections, what one answer records, the summary and the two
 * files. Nothing here sends a request.
 */

import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { sapErrorIn } from '../../src/utils/adtErrors';
import {
  extractSupportedAccept,
  extractSupportedContentType,
} from '../../src/utils/supportedMediaTypes';
import type { HeaderShape, IEnvelopeTiming, IWireHeaders } from './capture';
import {
  endpointKey,
  headerValue,
  type IRemoval,
  type ISentRequest,
  PROBE_TYPE,
  removalWord,
  textFrom,
  unproven,
} from './record';

/** The fixed name every probe works on; no system has an object of that name. */
export const PROBE_NAME = 'Z_HPEC_PROBE';
/** The package a create names: it does not exist either, so nothing is created on purpose. */
export const PROBE_PACKAGE = 'Z_HPEC_NO_PACKAGE';
/** The lock handle an unlock or a write under a lock sends. */
export const PROBE_HANDLE = 'Z_HPEC_NO_LOCK_HANDLE';
/** The body a write sends in `none` and `bogus` mode. */
export const FIXED_TEXT = `error corpus probe ${PROBE_NAME}`;

export type Source = 'discovery' | 'clients';
export type HeadersMode = 'corpus' | 'none' | 'bogus';

export const SOURCES: readonly Source[] = ['discovery', 'clients'];
export const HEADERS_MODES: readonly HeadersMode[] = [
  'corpus',
  'none',
  'bogus',
];

// --- the authorization check -------------------------------------------------

/** What the discovery read before anything else says about going on. */
export type AuthorizationVerdict =
  | { go: true }
  | { go: false; exitCode: number; line: string };

export function authorizationVerdict(
  status: number | undefined,
): AuthorizationVerdict {
  // A 401 or an authorization 403 is the run's authorization stop (the
  // watcher sees this read as it sees every other); this says the rest.
  if (status === undefined)
    return {
      go: false,
      exitCode: 1,
      line: 'The discovery read got no answer',
    };
  if (status < 200 || status >= 300)
    return {
      go: false,
      exitCode: 1,
      line: `The discovery read answered ${status}`,
    };
  return { go: true };
}

// --- the discovery document --------------------------------------------------

export interface ITemplateLink {
  rel?: string;
  template?: string;
  type?: string;
  title?: string;
}

export interface ICollection {
  /** The workspace's title: the endpoint group. */
  workspace: string;
  title?: string;
  href: string;
  /** The `app:accept` types, quotes removed, empty ones left out. */
  accept: string[];
  templates: ITemplateLink[];
}

const asList = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const textOf = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object')
    return String((value as Record<string, unknown>)['#text'] ?? '');
  return String(value);
};

const unquoted = (value: string): string => {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    (trimmed[0] === "'" || trimmed[0] === '"') &&
    trimmed[trimmed.length - 1] === trimmed[0]
  )
    return trimmed.slice(1, -1).trim();
  return trimmed;
};

/** Every `app:collection` of a discovery document, with its accept types and template links. */
export function parseDiscovery(xml: string): ICollection[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    processEntities: true,
    isArray: (name) =>
      ['workspace', 'collection', 'accept', 'templateLink'].includes(name),
  });
  const document = parser.parse(xml) as Record<string, unknown>;
  const service = document.service as Record<string, unknown> | undefined;
  const collections: ICollection[] = [];
  for (const workspace of asList(
    service?.workspace as Record<string, unknown>[] | undefined,
  )) {
    const group = textOf(workspace.title) || '(untitled)';
    for (const collection of asList(
      workspace.collection as Record<string, unknown>[] | undefined,
    )) {
      const href = String(collection['@_href'] ?? '');
      if (!href) continue;
      const links = (collection.templateLinks ?? {}) as Record<string, unknown>;
      collections.push({
        workspace: group,
        title: textOf(collection.title) || undefined,
        href,
        accept: asList(collection.accept as unknown[] | undefined)
          .map((value) => unquoted(textOf(value)))
          .filter(Boolean),
        templates: asList(
          links.templateLink as Record<string, unknown>[] | undefined,
        ).map((link) => ({
          rel: link['@_rel'] as string | undefined,
          template: link['@_template'] as string | undefined,
          type: link['@_type'] as string | undefined,
          title: link['@_title'] as string | undefined,
        })),
      });
    }
  }
  return collections;
}

/** The headers one probe asks for: a value, or absent. */
export interface IAskedHeaders {
  accept?: string;
  contentType?: string;
}

/** Which header a bogus row puts the probe type in; the other is the corpus one. */
export type BogusHeader = 'accept' | 'content-type';

/** One request of the discovery source, before it is sent. */
export interface IDiscoveryProbe {
  collection: ICollection;
  method: 'GET' | 'POST';
  asked: IAskedHeaders;
  /** In bogus mode: the header that carries the probe type. */
  bogus?: BogusHeader;
  /** The corpus type this row probes, in corpus mode. */
  corpusType?: string;
  /** Why the row has no corpus pair, in corpus mode. */
  noCorpusPair?: string;
  /** The pair's Content-Type a request without a body does not send. */
  contentTypeNotSent?: string;
  /** The body of a POST. */
  body?: string;
  /** `skipped: <reason>`: not sent. */
  skipped?: string;
}

/**
 * The long-poll endpoints: each holds the request while it waits, but only
 * when it accepts the headers — with no Accept or a bogus one it answers at
 * once. The none and bogus calls give the header verdict and the accepted
 * list; a call with working headers adds only the wait. So the corpus-header
 * mode, and phase 2's reads with the client's own headers, do not send them;
 * the none and bogus calls go out as before. Paths as the corpus keys them:
 * `{name}` stands for one path segment.
 *
 * Built from the saved runs: no call there took more than 30 s on its own
 * (the slow envelopes are 25–29 parts of about 1.5 s each). The ABAP Unit run
 * status is the one measured long poll. The debuggers' listen and the AMDP
 * debugger's events are not listed: the probe sends no debugger call in any
 * mode (`notSent`, `DEBUGGERS`). Discovery lists collections only, none of
 * them a long poll, so the list applies to the clients' members.
 */
export const LONG_POLL_ENDPOINTS: readonly {
  method: string;
  path: string;
  /** What the entry is, and what was measured. */
  what: string;
}[] = [
  {
    method: 'GET',
    path: '/sap/bc/adt/abapunit/runs/{name}',
    what: "ABAP Unit run status (the test runners' getStatus): with the corpus Accept it waits for the run it names to finish — measured 307 s on a run id that does not exist; with no Accept or a bogus one it answers at once",
  },
];

/** What a long-poll endpoint's row records in the corpus-header mode. */
export const LONG_POLL_SKIP =
  'skipped: long-poll, holds the request when the headers are accepted';

/** Whether a request is one of {@link LONG_POLL_ENDPOINTS}; `{name}` (or a concrete name) matches any one segment. */
export function isLongPoll(method: string, path: string): boolean {
  const segments = path.split('/');
  return LONG_POLL_ENDPOINTS.some((entry) => {
    if (entry.method !== method) return false;
    const pattern = entry.path.split('/');
    return (
      pattern.length === segments.length &&
      pattern.every(
        (part, index) =>
          part === segments[index] ||
          (part === '{name}' && Boolean(segments[index])),
      )
    );
  });
}

/**
 * The discovery requests the corpus does not send, and why: what attaches to
 * or waits for another session, what switches a trace on, and what answers a
 * logon ticket — a secret, which must not reach the corpus.
 */
export function notSent(href: string, method: string): string | undefined {
  const path = href.toLowerCase();
  if (path.includes('/security/reentranceticket'))
    return 'skipped: answers a logon ticket, a secret the corpus must not hold';
  if (
    path.startsWith('/sap/bc/adt/debugger') ||
    path.includes('/amdp/debugger') ||
    path.includes('/amdpdebugger')
  )
    return 'skipped: the debugger attaches to or listens for another session (long polling)';
  if (
    method === 'POST' &&
    (path.startsWith('/sap/bc/adt/st05/trace/state') ||
      path.startsWith('/sap/bc/adt/crosstrace/activations') ||
      path.startsWith('/sap/bc/adt/runtime/traces/abaptraces/requests'))
  )
    return 'skipped: a POST here switches a trace on or schedules one, under a key the server assigns';
  return undefined;
}

/** A minimal document of the given type, naming the probe object, or the fixed text. */
export function fakeBody(type: string | undefined): string {
  const lower = (type ?? '').toLowerCase();
  if (lower.includes('json')) return JSON.stringify({ name: PROBE_NAME });
  if (lower.includes('xml'))
    return `<?xml version="1.0" encoding="UTF-8"?><probe:errorCorpus xmlns:probe="http://www.example.com/error-corpus" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${PROBE_NAME}"/>`;
  return FIXED_TEXT;
}

/**
 * The headers a row asks for. A request without a body is given no
 * Content-Type in any mode. Bogus: the probe type in one header, the corpus
 * value in the other.
 */
export function askedFor(
  mode: HeadersMode,
  corpus: IAskedHeaders | undefined,
  hasBody: boolean,
  bogus?: BogusHeader,
): IAskedHeaders {
  const asked: IAskedHeaders =
    mode === 'none'
      ? {}
      : mode === 'bogus' && bogus === 'accept'
        ? { ...(corpus ?? {}), accept: PROBE_TYPE }
        : mode === 'bogus' && bogus === 'content-type'
          ? { ...(corpus ?? {}), contentType: PROBE_TYPE }
          : { ...(corpus ?? {}) };
  if (asked.accept === undefined || asked.accept === '') delete asked.accept;
  if (!hasBody || asked.contentType === '') delete asked.contentType;
  return asked;
}

/** The corpus Content-Type a request without a body does not send, as the row records it. */
export function contentTypeNotSent(
  corpus: IAskedHeaders | undefined,
  hasBody: boolean,
): string | undefined {
  return !hasBody && corpus?.contentType
    ? `not sent: no body (${corpus.contentType})`
    : undefined;
}

/** The bogus rows of one request: Accept always, Content-Type only with a body. */
export const bogusHeaders = (hasBody: boolean): BogusHeader[] =>
  hasBody ? ['accept', 'content-type'] : ['accept'];

/**
 * The discovery source's requests: a GET on every collection, plus a POST
 * where it lists `app:accept`. In corpus mode one row per listed type, with
 * that type as Accept and, with a body, as Content-Type. In bogus mode one
 * row per header, the corpus value being the first listed type.
 */
export function discoveryProbes(
  collections: readonly ICollection[],
  mode: HeadersMode,
): IDiscoveryProbe[] {
  const probes: IDiscoveryProbe[] = [];
  for (const collection of collections) {
    const methods: ('GET' | 'POST')[] = collection.accept.length
      ? ['GET', 'POST']
      : ['GET'];
    for (const method of methods) {
      const skipped = notSent(collection.href, method);
      if (skipped) {
        probes.push({ collection, method, asked: {}, skipped });
        continue;
      }
      const hasBody = method === 'POST';
      const body = (type?: string) =>
        hasBody ? (mode === 'none' ? FIXED_TEXT : fakeBody(type)) : undefined;
      // `app:accept` is the type of the request body: a Content-Type only.
      // Discovery names no Accept (measured: a POST sent with the listed type
      // as Accept was refused 406, naming a different, result type).
      const pairOf = (type: string | undefined): IAskedHeaders | undefined =>
        type ? { contentType: type } : undefined;
      const notSentNote = (type: string | undefined) => {
        const note = contentTypeNotSent(pairOf(type), hasBody);
        return note ? { contentTypeNotSent: note } : {};
      };
      if (mode === 'bogus') {
        const first = collection.accept[0];
        for (const bogus of bogusHeaders(hasBody))
          probes.push({
            collection,
            method,
            bogus,
            asked: askedFor(mode, pairOf(first), hasBody, bogus),
            body: body(first),
            ...(first ? { corpusType: first } : {}),
          });
        continue;
      }
      if (mode === 'none' || !collection.accept.length || !hasBody) {
        const types = collection.accept.join(', ');
        probes.push({
          collection,
          method,
          asked: askedFor(mode, undefined, hasBody),
          body: body(),
          ...(mode === 'corpus' && !collection.accept.length
            ? { noCorpusPair: 'the collection lists no app:accept' }
            : {}),
          ...(mode === 'corpus' && collection.accept.length
            ? { contentTypeNotSent: `not sent: no body (${types})` }
            : {}),
        });
        continue;
      }
      for (const type of collection.accept)
        probes.push({
          collection,
          method,
          asked: askedFor(mode, pairOf(type), hasBody),
          corpusType: type,
          body: body(type),
          ...notSentNote(type),
        });
    }
  }
  return probes;
}

// --- shaping the headers -----------------------------------------------------

const ACCEPT = 'accept';
const CONTENT_TYPE = 'content-type';

/**
 * How a mode shapes a request's headers before the connection sees them.
 *
 * Every mode: a request without a body carries no Content-Type, and an empty
 * value is no header. `none` takes Accept and Content-Type away; `bogus` puts
 * {@link PROBE_TYPE} in the one header the row probes and leaves the other as
 * the member built it. A header taken away is left out of an envelope part
 * (the part then carries none), and set to `undefined` on a request of its
 * own: the connection adds its default Accept for a missing key and none for
 * an `undefined` one — measured; what it adds for a body's Content-Type
 * stays, and the row says so.
 */
export function headerShape(
  mode: HeadersMode,
  parts: boolean,
  bogus?: BogusHeader,
): HeaderShape {
  return (headers, request) => {
    const shaped: Record<string, unknown> = {};
    let accept: unknown;
    let contentType: unknown;
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (lower === ACCEPT) accept = value;
      else if (lower === CONTENT_TYPE) contentType = value;
      else shaped[key] = value;
    }
    const hasBody = request.data !== undefined && request.data !== null;
    if (mode === 'none') {
      accept = undefined;
      contentType = undefined;
    }
    if (mode === 'bogus' && bogus === 'accept') accept = PROBE_TYPE;
    if (mode === 'bogus' && bogus === 'content-type') contentType = PROBE_TYPE;
    if (!hasBody) contentType = undefined;
    const put = (name: string, value: unknown) => {
      if (value !== undefined && value !== null && value !== '')
        shaped[name] = value;
      else if (!parts) shaped[name] = undefined;
    };
    put('Accept', accept);
    put('Content-Type', contentType);
    return shaped;
  };
}

/** In `none` mode: whether the wire carried neither header, or a default the connection added. */
export function wireNote(
  mode: HeadersMode,
  onWire: readonly IWireHeaders[],
): 'none on the wire' | 'defaults-not-removable' | undefined {
  if (mode !== 'none') return undefined;
  if (!onWire.length) return undefined;
  return onWire.some(
    (wire) => wire.accept !== null || wire.contentType !== null,
  )
    ? 'defaults-not-removable'
    : 'none on the wire';
}

// --- one answer --------------------------------------------------------------

/** What the error names as acceptable. The corpus's main column. */
export interface INamed {
  /** The raw text from `Accepted content types:` on. */
  acceptedText?: string;
  /** The raw text from `Supported Media Types:` on. */
  supportedText?: string;
  /** Every media type the SAP message text names. */
  inMessage: string[];
  /** `extractSupportedAccept(error)`, as returned. */
  supportedAccept: string[];
  /** `extractSupportedContentType(error)`, as returned. */
  supportedContentType: string[];
}

const ACCEPTED_MARKER = 'Accepted content types:';
const SUPPORTED_MARKER = 'Supported Media Types:';
const TOP_LEVEL = new Set([
  'application',
  'text',
  'multipart',
  'image',
  'audio',
  'video',
  'message',
  'font',
  'model',
  '*',
]);

/** RFC 9110 `tchar`: the characters of a token, as in a type or a subtype. */
const TCHAR_SYMBOLS = "!#$%&'*+-.^_`|~";
const isToken = (text: string): boolean => {
  if (!text) return false;
  for (const char of text) {
    const code = char.charCodeAt(0);
    const alnum =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122);
    if (!alnum && !TCHAR_SYMBOLS.includes(char)) return false;
  }
  return true;
};

/**
 * Whether one list item is a media type: `type/subtype`, each a token, with
 * optional `; name=value` parameters. Plain string code, no pattern over
 * SAP's text: `none`, or a sentence SAP put after the marker
 * (`System expected the element '{…}abapFunctionGroup'`), is no media type.
 */
export function isMediaType(item: string): boolean {
  const parts = item.split(';');
  const main = (parts[0] ?? '').trim();
  const slash = main.indexOf('/');
  // A second slash fails the subtype's token check.
  if (slash === -1) return false;
  if (!isToken(main.slice(0, slash)) || !isToken(main.slice(slash + 1)))
    return false;
  for (const parameter of parts.slice(1)) {
    const equals = parameter.indexOf('=');
    if (equals === -1 || !isToken(parameter.slice(0, equals).trim()))
      return false;
    if (!parameter.slice(equals + 1).trim()) return false;
  }
  return true;
}

/** The items of a list that are media types; the rest is dropped. */
export const realMediaTypes = (items: readonly string[]): string[] =>
  items.filter((item) => isMediaType(item));

/** Where a list after a marker ends: the element, an attribute or the line (as the client reads it). */
const LIST_ENDS = ['<', '"', '\n'];

/** Every item after `marker` in `text`, up to the list's end, split at commas; empty items dropped. */
export function listItemsAfter(
  text: string | undefined,
  marker: string,
): string[] {
  if (!text) return [];
  const items: string[] = [];
  let at = text.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    let end = text.length;
    for (const stop of LIST_ENDS) {
      const found = text.indexOf(stop, start);
      if (found !== -1 && found < end) end = found;
    }
    for (const entry of text.slice(start, end).split(',')) {
      const item = entry.trim();
      if (item) items.push(item);
    }
    at = text.indexOf(marker, end);
  }
  return items;
}

/** Every media type (`type/subtype`, a known top-level type) a text names, in order, once each. */
export function mediaTypesIn(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const raw of text.split(/[\s,;"'()<>[\]]+/)) {
    const token = raw.replace(/[.:]+$/, '');
    const slash = token.indexOf('/');
    if (slash <= 0 || slash === token.length - 1) continue;
    const top = token.slice(0, slash).toLowerCase();
    if (!TOP_LEVEL.has(top)) continue;
    const sub = token.slice(slash + 1);
    if (!/^[A-Za-z0-9*][A-Za-z0-9.+*_-]*$/.test(sub)) continue;
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

export function namedIn(
  body: string,
  sapMessage: string | undefined,
  wire: IAdtWireResponse | undefined,
): INamed {
  const named: INamed = {
    inMessage: mediaTypesIn(sapMessage),
    supportedAccept: [],
    supportedContentType: [],
  };
  const accepted = textFrom(body, ACCEPTED_MARKER);
  const supported = textFrom(body, SUPPORTED_MARKER);
  if (accepted) named.acceptedText = accepted;
  if (supported) named.supportedText = supported;
  if (wire) {
    const asError = { response: wire };
    named.supportedAccept = extractSupportedAccept(asError);
    named.supportedContentType = extractSupportedContentType(asError);
  }
  return named;
}

/** The state of the probe object after a write. */
export interface IWriteCheck {
  /** `true`: the probe name now exists — it was created, recorded and removed in the cleanup. */
  exists: boolean | 'unknown';
  status?: number;
  /** Why it could not be read. */
  note?: string;
}

export interface ICorpusRow {
  source: Source;
  /** The endpoint group: the discovery workspace, or the client handler. */
  group: string;
  /** clients: the member; discovery: the collection's title. */
  label: string;
  /** The endpoint pattern: method, path with the probe names as `{name}`, `_action`. */
  endpoint?: ISentRequest;
  /** Every request the call issued (a chain issues several). */
  requests: ISentRequest[];
  collection?: ICollection;
  /** What the mode asked for. */
  asked?: IAskedHeaders;
  /** In bogus mode: the header that carried the probe type. */
  bogus?: BogusHeader;
  /** The pair table's pair for this endpoint (clients: pairs.ts; discovery: the first app:accept type). */
  pair?: IAskedHeaders;
  /** The pair's Content-Type, not sent because the request has no body. */
  contentTypeNotSent?: string;
  /** Why no Accept went as the corpus value: `accept: not in discovery`. */
  acceptNote?: string;
  /** The corpus type this row probes. */
  corpusType?: string;
  /** Why a corpus-mode row has no prepared pair. */
  noCorpusPair?: string;
  /** Accept and Content-Type as they went on the wire, per request. */
  onWire: IWireHeaders[];
  wireNote?: 'none on the wire' | 'defaults-not-removable';
  /** `batched`, or `sequential: <reason>`. */
  ran?: string;
  status?: number;
  sapType?: string;
  sapMessage?: string;
  responseContentType?: string;
  /** The full body of the answer. */
  body?: string;
  named: INamed;
  /** Why there is no answer: nothing came back, or the call threw. */
  failure?: string;
  /** Read after a write probe (POST, PUT, DELETE). */
  afterWrite?: IWriteCheck;
  /** The temporary object the row ran on (`<type> <name>`), when it ran on one. */
  temporary?: string;
  /** What the run did on the object after the row (a lock freed). */
  objectNote?: string;
  /**
   * The answer was a lock of ours on the temporary object (403 "currently
   * editing" / "currently locked"): it says nothing of the headers.
   */
  blocked?: string;
  /** Where the member runs: on a temporary object, not coverable (why), or on the probe name. */
  coverage?: string;
  /** `skipped: <reason>`: the row was not sent. */
  skipped?: string;
  /** Sent again: what its envelope answered first. */
  inEnvelope?: string;
  /** Split out of a poisoned envelope: the depth and the envelope path it was settled at. */
  settled?: { depth: number; path: string };
  /** A single call whose own 500 poisoned its group: the cause of a poisoning. */
  poisonCause?: boolean;
  /** Request parameters a stand-in argument produced: the request is not what a real call sends. */
  standIn?: string[];
  /** The headers mode of the run the row came from (a full run's rows). */
  headersMode?: HeadersMode;
  /** Batched: the envelope it went out in (see {@link ICorpus.envelopes}). */
  envelope?: number;
  /** Sent on its own: the call's wall time in ms. Batched: its envelope's ms per part. */
  ms?: number;
}

export interface ICorpus {
  source: Source;
  headers: HeadersMode;
  startedAt: string;
  finishedAt?: string;
  /** The discovery collections the run read (discovery source). */
  collections?: ICollection[];
  rows: ICorpusRow[];
  removals: IRemoval[];
  /** Every request one at a time (`--sequential`), no envelope. */
  sequential?: boolean;
  /** Phase 2 of a full run: real objects in place of the probe name. */
  phase?: 2;
  /** What ended the run: `complete`, `interrupted (SIGINT)`, `stopped: authorization (…)`, `failed: …`. */
  endedBy?: string;
  /** Every envelope: parts, bytes, wall time from send to answer. */
  envelopes?: IEnvelopeTiming[];
  /** Every poisoned envelope: how it was split, what caused it. */
  splits?: ISplit[];
  /** Bogus mode: which headers each endpoint needs. */
  needs?: IEndpointNeeds[];
  /** Methods of the handlers that answer no promise: helpers, not members (clients source). */
  notMembers?: string[];
  /** What stopped the run, when something did. */
  error?: string;
  /** The temporary objects the clients run made for the members that work on one. */
  temporaryObjects?: {
    type: string;
    name?: string;
    parent?: string;
    reason?: string;
  }[];
  /** Where every member runs (clients source): on a temporary object, not coverable, or on the probe name. */
  coverage?: { member: string; coverage: string }[];
}

const SAP_PREFIX = 'SAP refused the request: ';

/** Whether an answer is a lock refusal: 403 "currently editing" or "currently locked". */
export function isLockRefusal(row: ICorpusRow): boolean {
  if (row.status !== 403) return false;
  const text = `${row.sapMessage ?? ''} ${row.body ?? ''}`;
  return (
    text.includes('currently editing') || text.includes('currently locked')
  );
}

/** Fills a row from the answer its call got. */
export function readCorpusAnswer(
  row: ICorpusRow,
  input: { wire?: IAdtWireResponse; failure?: string },
): ICorpusRow {
  const { wire } = input;
  if (!wire) {
    row.failure = input.failure ?? 'no answer';
    return row;
  }
  const body =
    typeof wire.data === 'string'
      ? wire.data
      : wire.data == null
        ? ''
        : JSON.stringify(wire.data);
  row.status = wire.status;
  row.responseContentType = headerValue(wire.headers, 'content-type');
  const refusal = sapErrorIn(body);
  if (refusal) {
    row.sapType = refusal.adtType;
    row.sapMessage = refusal.message.startsWith(SAP_PREFIX)
      ? refusal.message.slice(SAP_PREFIX.length)
      : refusal.message;
  }
  row.body = body;
  row.named = namedIn(body, row.sapMessage, wire);
  if (input.failure) row.failure = input.failure;
  return row;
}

export const emptyNamed = (): INamed => ({
  inMessage: [],
  supportedAccept: [],
  supportedContentType: [],
});

/** Whether a write's answer, or the read after it, leaves the probe name existing. */
export function writeCheck(wire: IAdtWireResponse | undefined): IWriteCheck {
  if (!wire) return { exists: 'unknown', note: 'no answer to the read' };
  if (wire.status === 404) return { exists: false, status: 404 };
  if (wire.status >= 200 && wire.status < 300)
    return { exists: true, status: wire.status };
  return { exists: 'unknown', status: wire.status };
}

export const isWrite = (method: string): boolean =>
  ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase());

// --- authorization -----------------------------------------------------------

/**
 * The SAP exception types that decide a 403 is the user's authorization:
 * those of `cx_adt_res_no_authority` / `cx_adt_res_no_authorization` (from
 * reading SAP's code), by their names. Another type that only mentions
 * authorization (measured: `ExceptionNoToggleAuthorization`, "Package
 * failure occurs for toggle …") is decided by its text.
 */
export function isAuthorizationType(type: string): boolean {
  const lower = type.toLowerCase();
  return [
    'noauthority',
    'noauthorization',
    'noauthorisation',
    'notauthorized',
    'notauthorised',
    'unauthorized',
  ].some((words) => lower.includes(words));
}

/** A 403 text that names a refusal of the user's authorization. */
export const AUTHORIZATION_TEXTS: readonly string[] = [
  'not authorized',
  'not authorised',
  'no authorization',
  'no authorisation',
  'authorization missing',
  'missing authorization',
  'keine berechtigung',
  'nicht berechtigt',
];

/** A 403 text that is about the object, not the user: a missing object or package. */
export const OBJECT_TEXTS: readonly string[] = [
  'does not exist',
  'not found',
  'package',
  'paket',
];

/**
 * Whether an answer is an authorization problem a person must fix: any 401;
 * a 403 that is a CSRF refusal (its text names the CSRF token); a 403 whose
 * SAP exception type names authorization, or whose text is one of
 * {@link AUTHORIZATION_TEXTS}, unless the text is about a missing object or
 * package ({@link OBJECT_TEXTS}).
 */
export function authorizationProblem(
  wire: Pick<IAdtWireResponse, 'status' | 'data' | 'headers'>,
): { status: number; kind: string } | undefined {
  const body =
    typeof wire.data === 'string'
      ? wire.data
      : wire.data == null
        ? ''
        : JSON.stringify(wire.data);
  const refusal = sapErrorIn(body);
  if (wire.status === 401)
    return { status: 401, kind: refusal?.adtType ?? 'no SAP exception' };
  if (wire.status !== 403) return undefined;
  const csrf = headerValue(wire.headers, 'x-csrf-token');
  if (
    (csrf ?? '').toLowerCase() === 'required' ||
    body.toLowerCase().includes('csrf')
  )
    return { status: 403, kind: 'CSRF' };
  const text = (refusal?.message ?? body).toLowerCase();
  const type = refusal?.adtType ?? '';
  // The type decides first: an authorization type is a stop, whatever the
  // text says ("not authorized to modify this package" included).
  if (isAuthorizationType(type)) return { status: 403, kind: type };
  // Otherwise the text decides — unless it is about the object, not the user.
  if (!AUTHORIZATION_TEXTS.some((words) => text.includes(words)))
    return undefined;
  if (OBJECT_TEXTS.some((words) => text.includes(words))) return undefined;
  return { status: 403, kind: type || 'authorization' };
}

// --- the summary -------------------------------------------------------------

export const statusOf = (row: ICorpusRow): string =>
  row.skipped
    ? 'skipped'
    : row.status !== undefined
      ? String(row.status)
      : 'no answer';

/** One row's endpoint as text, with its member or collection. */
export function rowKey(row: ICorpusRow): string {
  const endpoint = row.endpoint ? endpointKey(row.endpoint) : '(no request)';
  return row.source === 'clients'
    ? `${endpoint} — ${row.group}.${row.label}`
    : `${endpoint}${row.corpusType ? ` [${row.corpusType}]` : ''}`;
}

/** The calls the group split of earlier runs found poisoning envelopes. */
export function isolationKeys(
  corpora: readonly Pick<ICorpus, 'splits'>[],
): Set<string> {
  const keys = new Set<string>();
  for (const corpus of corpora)
    for (const split of corpus.splits ?? [])
      for (const cause of split.causes) keys.add(cause);
  return keys;
}

/**
 * Whether a row is one of those calls: its row key, or — a discovery row —
 * its endpoint whatever corpus type it carries.
 */
export function isIsolated(
  row: ICorpusRow,
  keys: ReadonlySet<string>,
): boolean {
  if (keys.has(rowKey(row))) return true;
  if (row.source !== 'discovery' || !row.endpoint) return false;
  const endpoint = endpointKey(row.endpoint);
  for (const key of keys) {
    const bracket = key.indexOf(' [');
    if ((bracket === -1 ? key : key.slice(0, bracket)) === endpoint)
      return true;
  }
  return false;
}

/** Rows per status, in status order. */
export function rowsByStatus(
  rows: readonly ICorpusRow[],
): Map<string, ICorpusRow[]> {
  const by = new Map<string, ICorpusRow[]>();
  for (const row of rows) {
    const status = statusOf(row);
    by.set(status, [...(by.get(status) ?? []), row]);
  }
  return new Map(
    [...by.entries()].sort(([a], [b]) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.localeCompare(b);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    }),
  );
}

/** The types a 406 or a 415 named: the raw texts' types first, then the message's, then the parsers'. */
export function typesNamed(row: ICorpusRow): {
  accept: string[];
  contentType: string[];
} {
  const fromText = [
    ...mediaTypesIn(row.named.acceptedText),
    ...mediaTypesIn(row.named.supportedText),
    ...row.named.inMessage,
  ];
  const unique = (values: string[]) => [...new Set(values)];
  if (row.status === 406)
    return {
      accept: unique([
        ...fromText,
        ...realMediaTypes(row.named.supportedAccept),
      ]),
      contentType: [],
    };
  if (row.status === 415)
    return {
      accept: [],
      contentType: unique([
        ...fromText,
        ...realMediaTypes(row.named.supportedContentType),
      ]),
    };
  return { accept: [], contentType: [] };
}

/**
 * Rows whose corpus pair the system refused: a 406 where the pair's Accept
 * was sent, a 415 where its Content-Type was. A 406 without an Accept, or a
 * 415 without a Content-Type, refuses no pair.
 */
export function refusedCorpusPairs(
  corpus: Pick<ICorpus, 'headers' | 'rows'>,
): ICorpusRow[] {
  if (corpus.headers !== 'corpus') return [];
  return corpus.rows.filter(
    (row) =>
      !row.noCorpusPair &&
      ((row.status === 406 && Boolean(row.asked?.accept)) ||
        (row.status === 415 && Boolean(row.asked?.contentType))),
  );
}

/** Per endpoint, the Accept and Content-Type values the system named, over one or more runs. */
export interface IEndpointNamed {
  endpoint: string;
  accept: string[];
  contentType: string[];
  /** The raw texts, as SAP wrote them. */
  texts: string[];
  /** `<headers mode>: <status>` per run that named something. */
  seenIn: string[];
}

export function namedPerEndpoint(
  corpora: readonly Pick<ICorpus, 'headers' | 'rows' | 'source'>[],
): IEndpointNamed[] {
  const by = new Map<string, IEndpointNamed>();
  for (const corpus of corpora)
    for (const row of corpus.rows) {
      if (!row.endpoint) continue;
      const named = typesNamed(row);
      const texts = [row.named.acceptedText, row.named.supportedText].filter(
        (text): text is string => Boolean(text),
      );
      if (!named.accept.length && !named.contentType.length && !texts.length)
        continue;
      const key = `${corpus.source}: ${endpointKey(row.endpoint)}`;
      const entry = by.get(key) ?? {
        endpoint: key,
        accept: [],
        contentType: [],
        texts: [],
        seenIn: [],
      };
      for (const type of named.accept)
        if (!entry.accept.includes(type)) entry.accept.push(type);
      for (const type of named.contentType)
        if (!entry.contentType.includes(type)) entry.contentType.push(type);
      for (const text of texts)
        if (!entry.texts.includes(text)) entry.texts.push(text);
      const seen = `${corpus.headers}: ${statusOf(row)}`;
      if (!entry.seenIn.includes(seen)) entry.seenIn.push(seen);
      by.set(key, entry);
    }
  return [...by.values()].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

// --- what each endpoint needs ---------------------------------------------

export type Needs = 'accept' | 'content-type' | 'both' | 'neither' | 'unknown';
export const NEEDS: readonly Needs[] = [
  'accept',
  'content-type',
  'both',
  'neither',
  'unknown',
];

/** What one bogus request says about its header. */
export interface IHeaderVerdict {
  verdict: 'checked' | 'not checked' | 'unknown' | 'no body';
  status?: number;
  reason?: string;
  /**
   * The phase whose answers decided the verdict, when it is not the phase of
   * the evidence carrying it (a phase-1 406 settled by phase 2's contrast).
   */
  decidedIn?: 1 | 2;
  /**
   * A 406 that names no accepted type (no T100 044, no list): the Accept may
   * not be what it refused. Checked only by contrast.
   */
  unnamed406?: boolean;
}

/** The T100 key of a SAP exception body, if it carries one. */
export function t100Of(
  body: string | undefined,
): { id: string; no: string } | undefined {
  if (!body) return undefined;
  const read = (key: string) => {
    const open = `<entry key="${key}">`;
    const at = body.indexOf(open);
    if (at === -1) return undefined;
    const end = body.indexOf('<', at + open.length);
    return end === -1 ? undefined : body.slice(at + open.length, end);
  };
  const id = read('T100KEY-ID');
  const no = read('T100KEY-NO');
  return id && no ? { id, no } : undefined;
}

/**
 * Whether a 406 names what the Accept should be: T100 SADT_RESOURCE 044
 * ("Accepted content types: …", its list empty or not), or a list naming at
 * least one accepted type. Only then does
 * the 406 point at the Accept. Any other 406 — SAP's generic default text
 * (`CX_ADT_RES_NOT_ACCEPTABLE` raised without a text id: T100 SADT_RESOURCE
 * 037, which the search raises for an invalid `objectType` whatever the
 * Accept), another T100 or none — says nothing of it.
 */
export function namesAccepted(row: ICorpusRow): boolean {
  const key = t100Of(row.body);
  return (
    // 044 is the Accept check, its list empty or not (measured on the DDIC
    // creates: 044 with an empty list).
    (key?.id === 'SADT_RESOURCE' && key.no === '044') ||
    // A list counts only with at least one type after the marker.
    listsAType(row.named?.acceptedText) ||
    realMediaTypes(row.named?.supportedAccept ?? []).length > 0 ||
    // A row built from the write cycle's answers may carry no named lists.
    listsAType(row.body)
  );
}

/**
 * Whether a text names at least one media type after `Accepted content
 * types:`. Items that are not media types are dropped first; a marker with
 * nothing left is a marker with no list.
 */
function listsAType(text: string | undefined): boolean {
  return realMediaTypes(listItemsAfter(text, ACCEPTED_MARKER)).length > 0;
}

/** The T100 key of a 406 that names nothing, for its reason. */
function unnamedReason(row: ICorpusRow): string {
  const key = t100Of(row.body);
  if (key?.id === 'SADT_RESOURCE' && key.no === '037')
    return '406 generic (T100 037): not necessarily the Accept';
  return `406 without a list (${key ? `T100 ${key.id} ${key.no}` : 'no T100'}): not necessarily the Accept`;
}

/** An unnamed 406 made `checked` by the contrast: another Accept got a 2xx or a 404 on the endpoint. */
export function byContrast(verdict: IHeaderVerdict): IHeaderVerdict {
  return {
    verdict: 'checked',
    status: 406,
    reason: verdict.reason?.startsWith('406 generic (T100 037)')
      ? '037, inferred from the contrast'
      : `${verdict.reason?.slice(0, verdict.reason.indexOf(':')) ?? '406'}, inferred from the contrast`,
  };
}

/** Whether a row shows another Accept than the bogus one reaching the resource: a 2xx or a 404. */
export function isContrast(row: ICorpusRow): boolean {
  return (
    row.bogus !== 'accept' &&
    row.status !== undefined &&
    ((row.status >= 200 && row.status < 300) || row.status === 404)
  );
}

/** What a Content-Type contrast found on one endpoint: the deciding pair's phase and statuses. */
export interface IContentTypeContrast {
  phase: 1 | 2;
  /** The 406 or 415 to the bogus or absent Content-Type. */
  refused: number;
  /** The answer to the working one. */
  answered: number;
}

/** The last request's headers on the wire, if recorded. */
const wireOf = (row: ICorpusRow) => row.onWire[row.onWire.length - 1];

/**
 * The Content-Type contrast: on one endpoint, two answers with the same
 * Accept on the wire (both absent, or the same value), one to a bogus or
 * absent Content-Type refused 406 or 415, the other to a working Content-Type
 * answered anything else (a 2xx, a 400 about the body, a 404, …): the
 * Content-Type made the difference. Measured: a resource can refuse an
 * unsupported Content-Type with a bare 406 (no body, no SAP exception)
 * instead of a 415. Per key, the earliest phase whose pair decides (a pair's
 * phase is its later row's).
 */
export function contentTypeContrasts(
  rows: readonly { row: ICorpusRow; phase: 1 | 2 }[],
  keyOf: (row: ICorpusRow) => string,
): Map<string, IContentTypeContrast> {
  const by = new Map<string, { row: ICorpusRow; phase: 1 | 2 }[]>();
  for (const item of rows)
    if (item.row.endpoint && item.row.status !== undefined && wireOf(item.row))
      by.set(keyOf(item.row), [...(by.get(keyOf(item.row)) ?? []), item]);
  const found = new Map<string, IContentTypeContrast>();
  for (const [key, items] of by)
    for (const refused of items) {
      const wire = wireOf(refused.row);
      const status = refused.row.status;
      if (!wire || (status !== 406 && status !== 415)) continue;
      if (wire.contentType !== null && wire.contentType !== PROBE_TYPE)
        continue;
      for (const working of items) {
        const other = wireOf(working.row);
        const answered = working.row.status;
        if (!other || answered === undefined) continue;
        if (answered === 406 || answered === 415) continue;
        if (other.contentType === null || other.contentType === PROBE_TYPE)
          continue;
        if (other.accept !== wire.accept) continue;
        const phase =
          working.phase > refused.phase ? working.phase : refused.phase;
        const known = found.get(key);
        if (!known || phase < known.phase)
          found.set(key, { phase, refused: status, answered });
      }
    }
  return found;
}

/** The Content-Type verdict a contrast gives: checked, naming the two statuses. */
export function byContentTypeContrast(
  contrast: IContentTypeContrast,
): IHeaderVerdict {
  return {
    verdict: 'checked',
    status: contrast.refused,
    reason: `inferred from the contrast: ${contrast.refused} without a working Content-Type, ${contrast.answered} with one`,
  };
}

/**
 * The contrast rule on evidence built outside {@link classifyNeeds} (the
 * write cycle, the update measurement, the reads): an unnamed 406 is
 * `checked` when a row of the same endpoint is a contrast.
 */
export function withContrast(
  evidence: readonly IEvidence[],
  rows: readonly ICorpusRow[],
  /** Phase 2's rows: a contrast found only there was decided in phase 2. */
  phase2Rows: readonly ICorpusRow[] = [],
): IEvidence[] {
  // Per endpoint, the earliest phase whose rows give a contrast.
  const contrast = new Map<string, 1 | 2>();
  for (const [phase, of] of [
    [2, phase2Rows],
    [1, rows],
  ] as const)
    for (const row of of)
      if (row.endpoint && isContrast(row))
        contrast.set(endpointKey(row.endpoint), phase);
  const typed = contentTypeContrasts(
    [
      ...rows.map((row) => ({ row, phase: 1 as const })),
      ...phase2Rows.map((row) => ({ row, phase: 2 as const })),
    ],
    (row) => (row.endpoint ? endpointKey(row.endpoint) : ''),
  );
  const later = (phase: 1 | 2, item: IEvidence) => {
    const decidedIn = phase > item.phase ? phase : item.phase;
    return decidedIn !== item.phase ? { decidedIn } : {};
  };
  return evidence.map((item) => {
    let out = item;
    const phase = contrast.get(item.endpoint);
    if (item.accept.unnamed406 && phase !== undefined)
      out = {
        ...out,
        accept: { ...byContrast(item.accept), ...later(phase, item) },
      };
    const ct = typed.get(item.endpoint);
    if (item.contentType.verdict === 'unknown' && ct)
      out = {
        ...out,
        contentType: {
          ...byContentTypeContrast(ct),
          ...later(ct.phase, item),
        },
      };
    return out;
  });
}

export interface IEndpointNeeds {
  endpoint: string;
  needs: Needs;
  /** The statuses behind `neither`, or the reason behind `unknown`. */
  detail: string;
  accept: IHeaderVerdict;
  contentType: IHeaderVerdict;
  /** The Accept values the 406 named. */
  namedAccept: string[];
  /** The Content-Type values the 415 named. */
  namedContentType: string[];
  /** Where the pair table names a header the system ignores here. */
  tableNotes: string[];
  /** The raw texts of the answers behind it (the named lists, else the SAP message). */
  texts: string[];
}

/** `needs` from the two verdicts. */
export function needsFrom(
  accept: IHeaderVerdict,
  contentType: IHeaderVerdict,
): Needs {
  const a = accept.verdict === 'checked';
  const c = contentType.verdict === 'checked';
  if (a && c) return 'both';
  if (a) return 'accept';
  if (c) return 'content-type';
  if (
    accept.verdict === 'not checked' &&
    (contentType.verdict === 'not checked' || contentType.verdict === 'no body')
  )
    return 'neither';
  return 'unknown';
}

/** The raw text of an answer: what the error names, else the SAP message, else a dump's text. */
export function rawText(row: ICorpusRow | undefined): string | undefined {
  if (!row) return undefined;
  return (
    [row.named.acceptedText, row.named.supportedText]
      .filter(Boolean)
      .join(' / ') ||
    row.sapMessage ||
    (row.status === 500 ? dumpText(row.body) : undefined)
  );
}

/** The endpoint a bogus row probes: its member, or its collection and method. */
export function needsKey(row: ICorpusRow): string {
  const endpoint = row.endpoint ? endpointKey(row.endpoint) : '(no request)';
  return row.source === 'clients'
    ? `${row.group}.${row.label} — ${endpoint}`
    : endpoint;
}

/** The short text of a 500: SAP's error page or a plain-text handler failure. */
export function dumpText(body: string | undefined): string | undefined {
  if (!body) return undefined;
  let text = body;
  for (const [open, close] of [
    ['<style', '</style>'],
    ['<script', '</script>'],
  ]) {
    for (;;) {
      const at = text.indexOf(open);
      if (at === -1) break;
      const end = text.indexOf(close, at);
      text =
        text.slice(0, at) + (end === -1 ? '' : text.slice(end + close.length));
    }
  }
  let plain = '';
  let inTag = false;
  for (const char of text) {
    if (char === '<') inTag = true;
    else if (char === '>') {
      inTag = false;
      plain += ' ';
    } else if (!inTag) plain += char;
  }
  plain = plain.split(/\s+/).join(' ').trim();
  const marker = 'Internal Server Error';
  const at = plain.indexOf(marker);
  if (at !== -1) plain = plain.slice(at + marker.length);
  const time = plain.indexOf('Server time');
  if (time !== -1) plain = plain.slice(0, time);
  plain = plain.trim();
  return plain ? plain.slice(0, 200) : undefined;
}

/** Whether an answer is the Accept check's `acceptHeaderMissing`: a 400 for a request without Accept. */
export function isAcceptHeaderMissing(row: ICorpusRow): boolean {
  return (
    row.status === 400 &&
    ((row.body ?? '').includes('acceptHeaderMissing') ||
      (row.sapMessage ?? '').includes('Accept header missing'))
  );
}

/**
 * What a bogus request says about the header it carried, by the order of
 * SAP's ADT REST framework (read from its code: logon, authorization, CSRF,
 * routing and method dispatch all come before any header is read; the 415
 * and the 406 are raised by `CL_ADT_REST_COMP_CNT_HANDLER` when the resource
 * reads or writes its body through it):
 * - `checked`: 406 for Accept, 415 for Content-Type;
 * - `not checked`: a 2xx — the resource never compared the header;
 * - `unknown`: anything else, which comes before or without a header check —
 *   405 `method not implemented`, 500 `dump or router` (with the dump's
 *   short text), any other status with its SAP exception.
 */
export function judge(
  row: ICorpusRow | undefined,
  refusal: 406 | 415,
): IHeaderVerdict {
  if (!row) return { verdict: 'no body' };
  if (row.skipped) return { verdict: 'unknown', reason: row.skipped };
  if (row.blocked)
    return { verdict: 'unknown', status: row.status, reason: row.blocked };
  if (row.status === undefined)
    return {
      verdict: 'unknown',
      reason: `no answer: ${row.failure ?? 'nothing came back'}`,
    };
  if (row.status === refusal && refusal === 406 && !namesAccepted(row))
    return {
      verdict: 'unknown',
      status: 406,
      reason: unnamedReason(row),
      unnamed406: true,
    };
  if (row.status === refusal) return { verdict: 'checked', status: row.status };
  if (row.status >= 200 && row.status < 300)
    return { verdict: 'not checked', status: row.status };
  if (row.status === 405)
    return {
      verdict: 'unknown',
      status: 405,
      reason: '405 method not implemented',
    };
  if (row.status === 500) {
    const text = dumpText(row.body);
    return {
      verdict: 'unknown',
      status: 500,
      reason: `500 dump or router${text ? `: ${text}` : ''}`,
    };
  }
  return {
    verdict: 'unknown',
    status: row.status,
    reason: `${row.status} ${row.sapType ?? '(no SAP exception)'}`,
  };
}

const verdictText = (name: string, verdict: IHeaderVerdict): string =>
  verdict.verdict === 'no body'
    ? `${name}: no body`
    : verdict.verdict === 'unknown'
      ? `${name}: unknown (${verdict.reason})`
      : `${name}: ${verdict.verdict} (${verdict.reason ?? verdict.status})`;

/**
 * Per endpoint of a bogus run: which headers it needs, and what the system
 * named. `evidence`: rows of other runs of the same source (a `none` run);
 * a 400 `acceptHeaderMissing` there, or on a bogus row sent without Accept,
 * shows the Accept check too.
 */
export function classifyNeeds(
  rows: readonly ICorpusRow[],
  evidence: readonly ICorpusRow[] = [],
): IEndpointNeeds[] {
  const by = new Map<
    string,
    { accept?: ICorpusRow; contentType?: ICorpusRow }
  >();
  for (const row of rows) {
    if (!row.bogus && !row.skipped) continue;
    const key = needsKey(row);
    const entry = by.get(key) ?? {};
    if (row.bogus === 'content-type') entry.contentType = row;
    else entry.accept ??= row;
    by.set(key, entry);
  }
  const contrast = new Set<string>();
  for (const row of evidence)
    if (!row.bogus && isContrast(row)) contrast.add(needsKey(row));
  const typedContrast = contentTypeContrasts(
    [...rows, ...evidence].map((row) => ({ row, phase: 1 as const })),
    needsKey,
  );
  const missing = new Map<string, ICorpusRow>();
  for (const row of [...rows, ...evidence])
    if (isAcceptHeaderMissing(row) && !missing.has(needsKey(row)))
      missing.set(needsKey(row), row);
  const out: IEndpointNeeds[] = [];
  for (const [endpoint, pair] of by) {
    let accept = judge(pair.accept, 406);
    // A 406 naming nothing to the bogus Accept, while another Accept (none,
    // or the client's own) got a 2xx or a 404 on the same endpoint: the
    // Accept made the difference after all.
    if (accept.unnamed406 && contrast.has(endpoint))
      accept = byContrast(accept);
    const absent = missing.get(endpoint);
    if (accept.verdict !== 'checked' && absent)
      accept = {
        verdict: 'checked',
        status: 400,
        reason: '400 acceptHeaderMissing without Accept',
      };
    let contentType = pair.contentType
      ? judge(pair.contentType, 415)
      : pair.accept?.skipped
        ? judge(pair.accept, 415)
        : ({ verdict: 'no body' } as IHeaderVerdict);
    const typed = typedContrast.get(endpoint);
    if (contentType.verdict === 'unknown' && typed)
      contentType = byContentTypeContrast(typed);
    const detail = [
      verdictText('Accept', accept),
      verdictText('Content-Type', contentType),
    ].join('; ');
    const needs = needsFrom(accept, contentType);
    const table = (pair.accept ?? pair.contentType)?.pair;
    const tableNotes: string[] = [];
    if (table?.accept && accept.verdict === 'not checked')
      tableNotes.push(
        `the pair table lists Accept ${table.accept}; the resource does not check Accept (a bogus one got ${accept.status})`,
      );
    if (table?.contentType && contentType.verdict === 'not checked')
      tableNotes.push(
        `the pair table lists Content-Type ${table.contentType}; the resource does not check Content-Type (a bogus one got ${contentType.status})`,
      );
    // Discovery's types are a POST body's: on its GET they are no claim.
    const source = (pair.accept ?? pair.contentType)?.source;
    if (
      source === 'clients' &&
      table?.contentType &&
      contentType.verdict === 'no body'
    )
      tableNotes.push(
        `the pair table lists Content-Type ${table.contentType} for a request without a body`,
      );
    out.push({
      endpoint,
      needs,
      detail,
      accept,
      contentType,
      namedAccept: [
        ...new Set([
          ...(pair.accept ? typesNamed(pair.accept).accept : []),
          ...(absent ? typesNamed({ ...absent, status: 406 }).accept : []),
        ]),
      ],
      namedContentType: pair.contentType
        ? typesNamed(pair.contentType).contentType
        : [],
      tableNotes,
      texts: [
        ...new Set(
          [pair.accept, pair.contentType, absent]
            .map((row) => rawText(row))
            .filter((text): text is string => Boolean(text)),
        ),
      ],
    });
  }
  return out.sort((x, y) => x.endpoint.localeCompare(y.endpoint));
}

/** The summary of a bogus run: endpoints per `needs`, with the values named. */
export function needsLines(entries: readonly IEndpointNeeds[]): string[] {
  const lines: string[] = [];
  lines.push('| needs | endpoints |', '|---|---|');
  for (const value of NEEDS)
    lines.push(
      `| ${value} | ${entries.filter((entry) => entry.needs === value).length} |`,
    );
  for (const value of NEEDS) {
    const of = entries.filter((entry) => entry.needs === value);
    lines.push('', `#### needs: ${value}`, '');
    if (!of.length) {
      lines.push('None.');
      continue;
    }
    lines.push(
      '| endpoint | detail | Accept named | Content-Type named | the pair table |',
      '|---|---|---|---|---|',
    );
    for (const entry of of)
      lines.push(
        `| ${cell(entry.endpoint)} | ${cell(entry.detail)} | ${cell(entry.namedAccept.join(', '))} | ${cell(entry.namedContentType.join(', '))} | ${cell(entry.tableNotes.join('; '))} |`,
      );
  }
  return lines;
}

// --- rendering ---------------------------------------------------------------

function cell(value: string | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

const headersText = (headers: IAskedHeaders | undefined): string => {
  if (!headers) return '';
  const parts = [
    headers.accept !== undefined ? `Accept: ${headers.accept}` : '',
    headers.contentType !== undefined
      ? `Content-Type: ${headers.contentType}`
      : '',
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : '(neither)';
};

const wireText = (onWire: readonly IWireHeaders[]): string =>
  onWire
    .map((wire) =>
      [
        `Accept: ${wire.accept ?? '—'}`,
        `Content-Type: ${wire.contentType ?? '—'}`,
      ].join('; '),
    )
    .join(' / ');

function namedText(named: INamed): string {
  return [
    named.acceptedText ?? '',
    named.supportedText ?? '',
    named.inMessage.length ? `message: ${named.inMessage.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function parsersText(named: INamed): string {
  return [
    named.supportedAccept.length
      ? `accept: ${named.supportedAccept.join(', ')}`
      : '',
    named.supportedContentType.length
      ? `content-type: ${named.supportedContentType.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function afterWriteText(check: IWriteCheck | undefined): string {
  if (!check) return '';
  if (check.exists === true)
    return '**exists: created, removed in the cleanup**';
  if (check.exists === false) return 'absent';
  return `unknown${check.status ? ` (${check.status})` : ''}${check.note ? `: ${check.note}` : ''}`;
}

/** The Markdown corpus: a table per endpoint group, then the summary. */
export function renderCorpusMarkdown(corpus: ICorpus): string {
  const lines: string[] = [
    `# Error corpus: ${corpus.source}, headers ${corpus.headers}${corpus.sequential ? ', sequential' : ''}`,
    '',
    `Started ${corpus.startedAt}${corpus.finishedAt ? `, finished ${corpus.finishedAt}` : ''}. Probe name \`${PROBE_NAME}\`, package \`${PROBE_PACKAGE}\`; bogus type \`${PROBE_TYPE}\`. The full bodies are in the JSON file.`,
    '',
  ];
  if (corpus.error)
    lines.push(`**The run stopped:** ${cell(corpus.error)}`, '');
  const groups = [...new Set(corpus.rows.map((row) => row.group))];
  for (const group of groups) {
    lines.push(
      `## ${cell(group)}`,
      '',
      '| endpoint | member / collection | ran | asked | on the wire | status | SAP type: message | response content-type | named by the error | parsers | after the write |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const row of corpus.rows.filter((entry) => entry.group === group)) {
      const endpoint = row.endpoint ? endpointKey(row.endpoint) : '';
      const chain =
        row.requests.length > 1
          ? ` (chain: ${row.requests.map(endpointKey).join(' → ')})`
          : '';
      const status = row.skipped
        ? row.skipped
        : row.status !== undefined
          ? String(row.status)
          : `no answer: ${row.failure ?? ''}`;
      const asked = [
        row.bogus ? `bogus ${row.bogus}:` : '',
        row.noCorpusPair !== undefined
          ? `no corpus pair: ${row.noCorpusPair}`
          : headersText(row.asked),
        row.contentTypeNotSent
          ? `(Content-Type ${row.contentTypeNotSent})`
          : '',
        row.acceptNote ? `(${row.acceptNote})` : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `| ${cell(endpoint + chain)} | ${cell(row.label)}${row.corpusType ? ` [${cell(row.corpusType)}]` : ''} | ${cell(row.ran)} | ${cell(asked)} | ${cell(wireText(row.onWire))}${row.wireNote ? ` (${row.wireNote})` : ''} | ${cell(status)} | ${cell([row.sapType, row.sapMessage].filter(Boolean).join(': '))} | ${cell(row.responseContentType)} | ${cell(namedText(row.named))} | ${cell(parsersText(row.named))} | ${afterWriteText(row.afterWrite)} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Summary', '', '### Time', '', ...timingLines(corpus), '');
  lines.push('### Poisoned envelopes', '');
  const splits = corpus.splits ?? [];
  if (!splits.length) lines.push('None.', '');
  else {
    lines.push(
      '| envelope | probes | envelopes the splitting sent | calls sent alone | ms | cause |',
      '|---|---|---|---|---|---|',
    );
    for (const split of splits)
      lines.push(
        `| ${split.envelope} | ${split.parts} | ${split.envelopes} | ${split.requestsAlone} | ${Math.round(split.ms)} | ${cell(split.causes.join('; ') || '(none found)')} |`,
      );
    lines.push(
      '',
      `Poisoned writes whose object exists after them: ${splits.flatMap((x) => x.writesThatExist ?? []).join('; ') || 'none'}.`,
      '',
      `${splits.length} poisoned envelope(s); the splitting sent ${splits.reduce((n, x) => n + x.envelopes, 0)} envelope(s) and ${splits.reduce((n, x) => n + x.requestsAlone, 0)} call(s) alone, in ${Math.round(splits.reduce((n, x) => n + x.ms, 0))} ms.`,
      '',
    );
  }
  const existence = existencePerEndpoint(corpus.rows);
  lines.push(
    '### Endpoint existence',
    '',
    '| exists | endpoints |',
    '|---|---|',
  );
  for (const value of ['yes', 'no', 'unknown'] as const)
    lines.push(
      `| ${value} | ${[...existence.values()].filter((e) => e.exists === value).length} |`,
    );
  lines.push('');
  lines.push('### Counts per status', '');
  const byStatus = rowsByStatus(corpus.rows);
  lines.push('| status | rows |', '|---|---|');
  for (const [status, rows] of byStatus)
    lines.push(`| ${status} | ${rows.length} |`);

  lines.push('', '### Endpoints per status', '');
  for (const [status, rows] of byStatus) {
    lines.push(`#### ${status}`, '');
    for (const row of rows)
      lines.push(
        `- ${cell(rowKey(row))}${row.skipped ? ` — ${cell(row.skipped)}` : ''}`,
      );
    lines.push('');
  }

  lines.push('### Every 406 and 415, with the types named', '');
  const refusals = corpus.rows.filter(
    (row) => row.status === 406 || row.status === 415,
  );
  if (!refusals.length) lines.push('None.');
  else {
    lines.push(
      '| status | endpoint | asked | named (raw) | named types |',
      '|---|---|---|---|---|',
    );
    for (const row of refusals) {
      const named = typesNamed(row);
      lines.push(
        `| ${row.status} | ${cell(rowKey(row))} | ${cell(headersText(row.asked))} | ${cell(namedText(row.named))} | ${cell([...named.accept, ...named.contentType].join(', ') || '(nothing)')} |`,
      );
    }
  }

  lines.push('', '### Corpus pairs refused', '');
  if (corpus.headers !== 'corpus')
    lines.push(`Not a corpus run (headers ${corpus.headers}).`);
  else {
    const refused = refusedCorpusPairs(corpus);
    if (!refused.length)
      lines.push('None: the system refused no corpus pair with 406 or 415.');
    for (const row of refused)
      lines.push(
        `- ${row.status} ${cell(rowKey(row))}: sent ${cell(headersText(row.asked))}; named ${cell([...typesNamed(row).accept, ...typesNamed(row).contentType].join(', ') || '(nothing)')}`,
      );
  }

  if (corpus.headers === 'bogus') {
    lines.push('', '### What each endpoint needs', '');
    lines.push(...needsLines(corpus.needs ?? classifyNeeds(corpus.rows)));
  }

  lines.push(
    '',
    '### Accept and Content-Type the system named, per endpoint',
    '',
  );
  lines.push(...namedTable(namedPerEndpoint([corpus])));

  const created = corpus.rows.filter((row) => row.afterWrite?.exists === true);
  lines.push('', '### Writes that created the probe name', '');
  if (!created.length) lines.push('None.');
  for (const row of created) lines.push(`- **${cell(rowKey(row))}**`);
  lines.push('', '### Cleanup', '');
  if (!corpus.removals.length) lines.push('Nothing to remove.');
  for (const removal of corpus.removals)
    lines.push(
      `- ${removal.removed === true ? 'removed' : `**${removalWord(removal)}**`}: ${cell(removal.label)} — ${cell(removal.detail)}`,
    );
  const left = unproven(corpus.removals);
  if (left.length)
    lines.push(
      '',
      `**${left.length} object(s) could not be removed or may remain; check and delete them by hand.**`,
    );
  lines.push('');
  return lines.join('\n');
}

function namedTable(entries: readonly IEndpointNamed[]): string[] {
  if (!entries.length) return ['Nothing was named.'];
  const lines = [
    '| endpoint | Accept named | Content-Type named | raw text | seen in |',
    '|---|---|---|---|---|',
  ];
  for (const entry of entries)
    lines.push(
      `| ${cell(entry.endpoint)} | ${cell(entry.accept.join(', '))} | ${cell(entry.contentType.join(', '))} | ${cell(entry.texts.join(' / '))} | ${cell(entry.seenIn.join(', '))} |`,
    );
  return lines;
}

/**
 * The header corpus: per endpoint, side by side, what the source lists (the
 * discovery Content-Type, or the pair table's pair) and what the 406s and
 * 415s named in the none and bogus runs.
 */
export function headerCorpusLines(corpora: readonly ICorpus[]): string[] {
  const lines: string[] = [];
  for (const source of SOURCES) {
    const of = corpora.filter((corpus) => corpus.source === source);
    if (!of.length) continue;
    const listed = new Map<string, string[]>();
    const named = new Map<string, Record<string, Set<string>>>();
    const needs = new Map<string, string>();
    for (const corpus of of)
      for (const row of corpus.rows) {
        if (!row.endpoint) continue;
        const key = needsKey(row);
        if (!listed.has(key))
          listed.set(
            key,
            source === 'discovery'
              ? (row.collection?.accept ?? []).map(
                  (type) => `Content-Type ${type}`,
                )
              : [
                  row.pair?.accept ? `Accept ${row.pair.accept}` : '',
                  row.pair?.contentType
                    ? `Content-Type ${row.pair.contentType}`
                    : '',
                ].filter(Boolean),
          );
        if (corpus.headers === 'corpus') continue;
        const types = typesNamed(row);
        const entry = named.get(key) ?? {};
        const add = (column: string, values: string[]) => {
          entry[column] ??= new Set();
          for (const value of values) entry[column].add(value);
        };
        add(`${corpus.headers} accept`, types.accept);
        add(`${corpus.headers} content-type`, types.contentType);
        named.set(key, entry);
      }
    const evidence = of
      .filter((c) => c.headers === 'none' || c.headers === 'corpus')
      .flatMap((c) => c.rows);
    for (const corpus of of.filter((c) => c.headers === 'bogus'))
      for (const entry of classifyNeeds(corpus.rows, evidence))
        needs.set(entry.endpoint, `${entry.needs} (${entry.detail})`);
    lines.push(
      `## The header corpus: ${source}`,
      '',
      `| endpoint | ${source === 'discovery' ? 'discovery lists' : 'the pair table lists'} | none: Accept named | none: Content-Type named | bogus: Accept named | bogus: Content-Type named | needs (bogus) |`,
      '|---|---|---|---|---|---|---|',
    );
    for (const key of [...listed.keys()].sort()) {
      const entry = named.get(key) ?? {};
      const column = (name: string) => [...(entry[name] ?? [])].join(', ');
      lines.push(
        `| ${cell(key)} | ${cell((listed.get(key) ?? []).join('; '))} | ${cell(column('none accept'))} | ${cell(column('none content-type'))} | ${cell(column('bogus accept'))} | ${cell(column('bogus content-type'))} | ${cell(needs.get(key))} |`,
      );
    }
    lines.push('');
  }
  return lines;
}

/** A poisoned envelope and its splitting. */
export interface ISplit {
  envelope: number | string;
  /** Its probes. */
  parts: number;
  /** The calls whose own 500 poisoned their group. */
  causes: string[];
  /** Its writes (not resent) whose object exists after them. */
  writesThatExist: string[];
  /** Envelopes the splitting sent. */
  envelopes: number;
  /** Calls sent alone (each a poisoned single). */
  requestsAlone: number;
  /** Wall time of the splitting. */
  ms: number;
}

/** Total, median and 95th percentile of a list of numbers (nearest rank). */
export function stats(values: readonly number[]): {
  count: number;
  total: number;
  median: number;
  p95: number;
} {
  if (!values.length) return { count: 0, total: 0, median: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (q: number) =>
    sorted[
      Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
    ];
  return {
    count: sorted.length,
    total: sorted.reduce((sum, value) => sum + value, 0),
    median: rank(0.5),
    p95: rank(0.95),
  };
}

const ms = (value: number) => `${Math.round(value)} ms`;

/** The timing summary: envelopes, parts per envelope, ms per envelope and per part; requests sent on their own. */
export function timingLines(corpus: ICorpus): string[] {
  const envelopes = corpus.envelopes ?? [];
  const lines = [
    '| measure | count | total | median | p95 |',
    '|---|---|---|---|---|',
  ];
  const row = (name: string, values: number[], unit: (v: number) => string) => {
    const s = stats(values);
    lines.push(
      `| ${name} | ${s.count} | ${unit(s.total)} | ${unit(s.median)} | ${unit(s.p95)} |`,
    );
  };
  const count = (v: number) => String(Math.round(v));
  row(
    'parts per envelope',
    envelopes.map((e) => e.parts),
    count,
  );
  row(
    'bytes per envelope',
    envelopes.map((e) => e.bytes),
    count,
  );
  row(
    'ms per envelope',
    envelopes.map((e) => e.ms),
    ms,
  );
  row(
    'ms per part',
    envelopes.flatMap((e) => Array(e.parts).fill(e.msPerPart)),
    ms,
  );
  row(
    'ms per request sent on its own',
    corpus.rows
      .filter((r) => r.envelope === undefined && r.ms !== undefined)
      .map((r) => r.ms as number),
    ms,
  );
  return lines;
}

/** The summary over several runs: per endpoint, what the system named in any mode. */
export function renderNamedSummary(corpora: readonly ICorpus[]): string {
  const lines = [
    '# Error corpus: what the system named, per endpoint',
    '',
    'Runs:',
    '',
    ...corpora.map(
      (corpus) =>
        `- ${corpus.source}, headers ${corpus.headers}, started ${corpus.startedAt}: ${corpus.rows.length} rows`,
    ),
    '',
    ...namedTable(namedPerEndpoint(corpora)),
    '',
  ];
  lines.push(...headerCorpusLines(corpora));
  for (const corpus of corpora.filter((c) => c.headers === 'bogus'))
    lines.push(
      `## What each endpoint needs: ${corpus.source}`,
      '',
      ...needsLines(
        classifyNeeds(
          corpus.rows,
          corpora
            .filter(
              (c) =>
                c.source === corpus.source &&
                (c.headers === 'none' || c.headers === 'corpus'),
            )
            .flatMap((c) => c.rows),
        ),
      ),
      '',
    );
  return lines.join('\n');
}

// --- the header corpus: one file per system ----------------------------------

// --- endpoint existence -----------------------------------------------------

export type Exists = 'yes' | 'no' | 'unknown';

/**
 * Whether an answer shows the endpoint exists, by where it came from.
 * `no`: the router found no route (a 404 with no SAP exception, "No
 * suitable resource found"), the ICF service is not there (a 404 "Service
 * cannot be reached"), or the method is not implemented (405). `yes`: any
 * answer from the resource itself — a 2xx, 400, 406, 415, a 404 the
 * resource raised (`ExceptionResourceNotFound`: the object is missing, the
 * endpoint is there), … `unknown`: what comes before the resource or says
 * nothing of it — 401, an authorization 403, a 500 (a router failure or a
 * dump), no answer, a skipped row.
 */
export function existenceOf(row: ICorpusRow): {
  exists: Exists;
  reason: string;
} {
  if (row.skipped) return { exists: 'unknown', reason: row.skipped };
  if (row.status === undefined)
    return {
      exists: 'unknown',
      reason: `no answer: ${row.failure ?? ''}`.trim(),
    };
  const body = row.body ?? '';
  if (row.status === 404 && !row.sapType) {
    if (body.includes('No suitable resource found'))
      return {
        exists: 'no',
        reason: '404 no route (No suitable resource found)',
      };
    if (body.includes('Service cannot be reached'))
      return { exists: 'no', reason: '404 the ICF service cannot be reached' };
    return { exists: 'unknown', reason: '404 without a SAP exception' };
  }
  if (row.status === 405)
    return { exists: 'no', reason: '405 method not implemented' };
  if (row.status === 401) return { exists: 'unknown', reason: '401' };
  if (row.status === 500)
    return {
      exists: 'unknown',
      reason: `500 ${dumpText(body) ?? 'dump or router'}`,
    };
  if (
    row.status === 403 &&
    authorizationProblem({ status: 403, data: body, headers: {} })
  )
    return { exists: 'unknown', reason: '403 authorization' };
  return {
    exists: 'yes',
    reason: `${row.status}${row.sapType ? ` ${row.sapType}` : ''}`,
  };
}

/** Per endpoint over many rows: yes if any answer came from the resource, else no if any said so, else unknown. */
export function existencePerEndpoint(
  rows: readonly ICorpusRow[],
): Map<string, { exists: Exists; reason: string }> {
  const by = new Map<string, { exists: Exists; reason: string }>();
  const rank: Record<Exists, number> = { yes: 2, no: 1, unknown: 0 };
  for (const row of rows) {
    if (!row.endpoint) continue;
    const key = endpointKey(row.endpoint);
    const found = existenceOf(row);
    const held = by.get(key);
    if (!held || rank[found.exists] > rank[held.exists]) by.set(key, found);
  }
  return by;
}

/** One piece of evidence about an endpoint's headers. */
export interface IEvidence {
  /** `METHOD path[?_action=…]`. */
  endpoint: string;
  source: Source;
  phase: 1 | 2;
  /** The member or collection the evidence came from. */
  who: string;
  accept: IHeaderVerdict;
  contentType: IHeaderVerdict;
  namedAccept: string[];
  namedContentType: string[];
  /** Status and raw text. */
  text: string;
}

/** The evidence a `needs` classification carries, per endpoint. */
export function evidenceOf(
  entries: readonly IEndpointNeeds[],
  source: Source,
  phase: 1 | 2,
): IEvidence[] {
  return entries.map((entry) => {
    const split = entry.endpoint.indexOf(' — ');
    const endpoint =
      split === -1 ? entry.endpoint : entry.endpoint.slice(split + 3);
    const who = split === -1 ? source : entry.endpoint.slice(0, split);
    return {
      endpoint,
      source,
      phase,
      who,
      accept: entry.accept,
      contentType: entry.contentType,
      namedAccept: entry.namedAccept,
      namedContentType: entry.namedContentType,
      text: [entry.detail, ...entry.texts].join(' | '),
    };
  });
}

const RANK: Record<IHeaderVerdict['verdict'], number> = {
  checked: 3,
  'not checked': 2,
  unknown: 1,
  'no body': 0,
};

/**
 * Several verdicts on one header of one endpoint: `checked` if any request
 * was refused for it, else `not checked` if any got through, else unknown
 * (reasons kept), else no body. A request with a body outranks one without.
 */
export function mergeVerdicts(
  verdicts: readonly IHeaderVerdict[],
): IHeaderVerdict {
  let best: IHeaderVerdict = { verdict: 'no body' };
  const reasons = new Set<string>();
  for (const verdict of verdicts) {
    if (verdict.verdict === 'unknown' && verdict.reason)
      reasons.add(verdict.reason);
    if (RANK[verdict.verdict] > RANK[best.verdict]) best = verdict;
  }
  if (best.verdict === 'unknown')
    return { ...best, reason: [...reasons].slice(0, 3).join('; ') };
  return best;
}

export interface IHeaderCorpusEntry {
  endpoint: string;
  needs: Needs;
  accept: IHeaderVerdict;
  contentType: IHeaderVerdict;
  /** The acceptable Accept values the system named. */
  namedAccept: string[];
  /** The acceptable Content-Type values the system named. */
  namedContentType: string[];
  /** What discovery lists as the body's type. */
  discoveryContentType: string[];
  /** The pair table's pairs of the members that send it. */
  pairs: string[];
  /** Which phase settled it, or why nothing did. */
  settledBy: 'phase 1' | 'phase 2' | 'unsettled';
  /** Whether the endpoint exists, and the answer that says so. */
  exists: Exists;
  existsBecause: string;
  /** What the client sends today, and the answer it got (corpus mode, phase 1 and 2). */
  knownWorking: string[];
  /** The Accept values the client sends that got a 2xx. */
  workingAccept: string[];
  /**
   * The Content-Type values that got through to the body: a 2xx, or a 400
   * about the body's content (`ExceptionInvalidData`).
   */
  workingContentType: string[];
  /** Who said what: status and raw text. */
  evidence: string[];
  /** Per evidence line, index for index: its verdicts and the phase that decided each. */
  verdicts: IEvidenceVerdicts[];
}

/** One evidence line's verdicts, kept for the self-check. */
export interface IEvidenceVerdicts {
  accept: { verdict: IHeaderVerdict['verdict']; status?: number; phase: 1 | 2 };
  contentType: {
    verdict: IHeaderVerdict['verdict'];
    status?: number;
    phase: 1 | 2;
  };
}

const verdictOfLine = (
  verdict: IHeaderVerdict,
  phase: 1 | 2,
): IEvidenceVerdicts['accept'] => ({
  verdict: verdict.verdict,
  ...(verdict.status !== undefined ? { status: verdict.status } : {}),
  phase: verdict.decidedIn ?? phase,
});

/** The self-check of a header corpus: what its records claim that its evidence does not show. */
export interface ISelfCheck {
  /** Records whose `settledBy` phase has no evidence line with the record's decided verdict. */
  settledWithoutEvidence: {
    endpoint: string;
    settledBy: string;
    accept: string;
    contentType: string;
  }[];
  /** Evidence lines where a list marker is followed by something that is not a media type. */
  markerWithoutMediaType: {
    endpoint: string;
    status?: number;
    marker: string;
    text: string;
  }[];
}

const DECIDED = new Set<IHeaderVerdict['verdict']>(['checked', 'not checked']);

/** The self-check, from the final corpus alone. */
export function selfCheck(entries: readonly IHeaderCorpusEntry[]): ISelfCheck {
  const settledWithoutEvidence: ISelfCheck['settledWithoutEvidence'] = [];
  const markerWithoutMediaType: ISelfCheck['markerWithoutMediaType'] = [];
  for (const entry of entries) {
    if (entry.settledBy !== 'unsettled') {
      const phase = entry.settledBy === 'phase 1' ? 1 : 2;
      const shows = entry.verdicts.some(
        (line) =>
          (DECIDED.has(entry.accept.verdict) &&
            line.accept.phase === phase &&
            line.accept.verdict === entry.accept.verdict) ||
          (DECIDED.has(entry.contentType.verdict) &&
            line.contentType.phase === phase &&
            line.contentType.verdict === entry.contentType.verdict),
      );
      if (!shows)
        settledWithoutEvidence.push({
          endpoint: entry.endpoint,
          settledBy: entry.settledBy,
          accept: entry.accept.verdict,
          contentType: entry.contentType.verdict,
        });
    }
    for (const [index, line] of entry.evidence.entries())
      for (const segment of line.split(' | '))
        for (const [marker, header] of [
          [ACCEPTED_MARKER, 'accept'],
          [SUPPORTED_MARKER, 'contentType'],
        ] as const)
          for (const item of listItemsAfter(segment, marker))
            if (!isMediaType(item)) {
              const status = entry.verdicts[index]?.[header].status;
              markerWithoutMediaType.push({
                endpoint: entry.endpoint,
                ...(status !== undefined ? { status } : {}),
                marker,
                text: item.slice(0, 200),
              });
            }
  }
  return { settledWithoutEvidence, markerWithoutMediaType };
}

/** The self-check as Markdown: a count and a list per check, 0 when empty. */
export function selfCheckLines(check: ISelfCheck): string[] {
  const lines = ['', '## Self-check', ''];
  lines.push(
    `### settledBy without evidence: ${check.settledWithoutEvidence.length}`,
    '',
  );
  if (check.settledWithoutEvidence.length) {
    lines.push(
      '| endpoint | settled by | Accept | Content-Type |',
      '|---|---|---|---|',
    );
    for (const item of check.settledWithoutEvidence)
      lines.push(
        `| ${cell(item.endpoint)} | ${item.settledBy} | ${item.accept} | ${item.contentType} |`,
      );
    lines.push('');
  }
  lines.push(
    `### A marker followed by no media type: ${check.markerWithoutMediaType.length}`,
    '',
  );
  if (check.markerWithoutMediaType.length) {
    lines.push('| endpoint | status | marker | text |', '|---|---|---|---|');
    for (const item of check.markerWithoutMediaType)
      lines.push(
        `| ${cell(item.endpoint)} | ${item.status ?? '—'} | ${cell(item.marker)} | ${cell(item.text)} |`,
      );
  }
  return lines;
}

/**
 * Per endpoint, the Content-Type values that got through: on the wire (not
 * the bogus type), answered a 2xx or a 400 about the body's content
 * (`ExceptionInvalidData`) — the resource read the body, so it took the type.
 */
export function workingContentTypes(
  rows: readonly ICorpusRow[],
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.endpoint || row.skipped || row.status === undefined) continue;
    const contentType = row.onWire[row.onWire.length - 1]?.contentType;
    if (!contentType || contentType === PROBE_TYPE) continue;
    const through =
      (row.status >= 200 && row.status < 300) ||
      (row.status === 400 && row.sapType === 'ExceptionInvalidData');
    if (!through) continue;
    const key = endpointKey(row.endpoint);
    found.set(key, [...new Set([...(found.get(key) ?? []), contentType])]);
  }
  return found;
}

const unknownLater: IHeaderVerdict = {
  verdict: 'unknown',
  reason: 'decided by a later phase',
};

/** The header corpus: per endpoint, everything the phases found. */
export function buildHeaderCorpus(
  evidence: readonly IEvidence[],
  extras: {
    discoveryContentType: ReadonlyMap<string, readonly string[]>;
    pairs: ReadonlyMap<string, readonly string[]>;
    /** Per endpoint, from every row of every run. */
    existence?: ReadonlyMap<string, { exists: Exists; reason: string }>;
    /** Per endpoint: `who: Accept … → status`. */
    knownWorking?: ReadonlyMap<string, readonly string[]>;
    /** Per endpoint: the Content-Type values that got through ({@link workingContentTypes}). */
    workingContentType?: ReadonlyMap<string, readonly string[]>;
  },
): IHeaderCorpusEntry[] {
  const by = new Map<string, IEvidence[]>();
  for (const item of evidence)
    by.set(item.endpoint, [...(by.get(item.endpoint) ?? []), item]);
  const entries: IHeaderCorpusEntry[] = [];
  for (const [endpoint, items] of by) {
    const merged = (of: readonly IEvidence[]) => ({
      accept: mergeVerdicts(of.map((item) => item.accept)),
      contentType: mergeVerdicts(of.map((item) => item.contentType)),
    });
    const all = merged(items);
    // What phase 1 alone decided: a verdict decided by a later phase's
    // answers is not phase 1's.
    const ofPhase = (phase: 1 | 2) =>
      items
        .filter((item) => item.phase <= phase)
        .map((item) => ({
          ...item,
          accept:
            (item.accept.decidedIn ?? item.phase) <= phase
              ? item.accept
              : unknownLater,
          contentType:
            (item.contentType.decidedIn ?? item.phase) <= phase
              ? item.contentType
              : unknownLater,
        }));
    const first = merged(ofPhase(1));
    const needs = needsFrom(all.accept, all.contentType);
    const settledBy =
      needs === 'unknown'
        ? 'unsettled'
        : needsFrom(first.accept, first.contentType) === needs
          ? 'phase 1'
          : 'phase 2';
    entries.push({
      endpoint,
      needs,
      accept: all.accept,
      contentType: all.contentType,
      namedAccept: [...new Set(items.flatMap((item) => item.namedAccept))],
      namedContentType: [
        ...new Set(items.flatMap((item) => item.namedContentType)),
      ],
      discoveryContentType: [
        ...(extras.discoveryContentType.get(endpoint) ?? []),
      ],
      pairs: [...(extras.pairs.get(endpoint) ?? [])],
      settledBy,
      exists: extras.existence?.get(endpoint)?.exists ?? 'unknown',
      existsBecause:
        extras.existence?.get(endpoint)?.reason ?? 'no answer recorded',
      knownWorking: [...(extras.knownWorking?.get(endpoint) ?? [])],
      workingAccept: [
        ...new Set(
          (extras.knownWorking?.get(endpoint) ?? [])
            .filter((text) => text.endsWith(' (works)'))
            .map((text) =>
              text.slice(text.indexOf('Accept ') + 7, text.lastIndexOf(' → ')),
            ),
        ),
      ],
      workingContentType: [...(extras.workingContentType?.get(endpoint) ?? [])],
      evidence: items.map(
        (item) =>
          `phase ${item.phase} ${item.source} ${item.who}: ${item.text}`,
      ),
      verdicts: items.map((item) => ({
        accept: verdictOfLine(item.accept, item.phase),
        contentType: verdictOfLine(item.contentType, item.phase),
      })),
    });
  }
  return entries.sort((x, y) => x.endpoint.localeCompare(y.endpoint));
}

/** Counts per `needs` value. */
export function needsCounts(
  entries: readonly { needs: Needs }[],
): Record<Needs, number> {
  const counts = Object.fromEntries(NEEDS.map((n) => [n, 0])) as Record<
    Needs,
    number
  >;
  for (const entry of entries) counts[entry.needs]++;
  return counts;
}

export interface IHeaderCorpusFile {
  startedAt: string;
  finishedAt?: string;
  /** Wall time per phase, in ms. */
  phases: { name: string; ms: number }[];
  totalMs: number;
  /** Per `needs` value, after phase 1 alone and after phase 2. */
  counts: { phase1: Record<Needs, number>; phase2: Record<Needs, number> };
  entries: IHeaderCorpusEntry[];
  /** The raw corpora beside it. */
  corpora: string[];
  /** What phase 2's write cycle created and removed (or could not). */
  removals: IRemoval[];
  /** What ended the run. */
  endedBy?: string;
  /** Phase 2's update measurement: per object type, the update's answer to a bogus Accept and whether it took effect. */
  updates?: {
    type: string;
    member: string;
    status?: number;
    sapType?: string;
    applied: boolean | 'unknown';
    note?: string;
  }[];
  /** Phase 2's read objects: per object type, the name found or why none. */
  /** The temporary objects the clients runs made (per mode), and why one could not be. */
  objects: {
    handler: string;
    type?: string;
    name?: string;
    parent?: string;
    reason?: string;
    note?: string;
  }[];
  /** Where every clients member runs: a temporary object, not coverable (why), or the probe name. */
  coverage?: { member: string; coverage: string }[];
  /** What the records claim that the evidence does not show. */
  selfCheck?: ISelfCheck;
  error?: string;
}

/** The header corpus as Markdown: the timing, the counts, a table per `needs` value. */
export function renderHeaderCorpus(file: IHeaderCorpusFile): string {
  const lines = [
    '# Header corpus',
    '',
    `Started ${file.startedAt}${file.finishedAt ? `, finished ${file.finishedAt}` : ''}; total ${Math.round(file.totalMs / 1000)} s.`,
    '',
  ];
  if (file.error) lines.push(`**The run stopped:** ${cell(file.error)}`, '');
  lines.push('## Time', '', '| phase | s |', '|---|---|');
  for (const phase of file.phases)
    lines.push(`| ${cell(phase.name)} | ${(phase.ms / 1000).toFixed(1)} |`);
  lines.push(
    '',
    '## needs',
    '',
    '| needs | after phase 1 | after phase 2 |',
    '|---|---|---|',
  );
  for (const value of NEEDS)
    lines.push(
      `| ${value} | ${file.counts.phase1[value]} | ${file.counts.phase2[value]} |`,
    );
  if (file.selfCheck) lines.push(...selfCheckLines(file.selfCheck));
  lines.push(
    '',
    '## Endpoint existence',
    '',
    '| exists | endpoints |',
    '|---|---|',
  );
  for (const value of ['yes', 'no', 'unknown'] as const)
    lines.push(
      `| ${value} | ${file.entries.filter((entry) => entry.exists === value).length} |`,
    );
  for (const value of NEEDS) {
    const of = file.entries.filter((entry) => entry.needs === value);
    lines.push('', `## needs: ${value} (${of.length})`, '');
    if (!of.length) {
      lines.push('None.');
      continue;
    }
    lines.push(
      '| endpoint | exists | Accept named | Content-Type named | discovery Content-Type | pair table | knownWorking | workingContentType | settled by | evidence |',
      '|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const entry of of)
      lines.push(
        `| ${cell(entry.endpoint)} | ${entry.exists} (${cell(entry.existsBecause)}) | ${cell(entry.namedAccept.join(', '))} | ${cell(entry.namedContentType.join(', '))} | ${cell(entry.discoveryContentType.join(', '))} | ${cell(entry.pairs.join('; '))} | ${cell(entry.knownWorking.join('; '))} | ${cell(entry.workingContentType.join(', '))} | ${entry.settledBy} | ${cell(entry.evidence.join(' ‖ ').slice(0, 600))} |`,
      );
  }
  lines.push('', '## Updates with a bogus Accept', '');
  if (!file.updates?.length) lines.push('Not measured.');
  else {
    lines.push(
      'Per object type, on a temporary object: the content read, an update changing it sent with a bogus Accept, the content read again; applied = the two hashes differ.',
      '',
      '| type | member | update answer | applied |',
      '|---|---|---|---|',
    );
    for (const update of file.updates)
      lines.push(
        `| ${cell(update.type)} | ${update.member} | ${update.status ?? '—'}${update.sapType ? ` ${cell(update.sapType)}` : ''} | ${update.applied === 'unknown' ? `unknown${update.note ? ` (${cell(update.note)})` : ''}` : update.applied ? 'yes' : 'no'} |`,
      );
  }
  lines.push('', '## Temporary objects', '');
  if (!file.objects.length) lines.push('None made.');
  for (const object of file.objects)
    lines.push(
      `- ${cell(object.handler)}${object.type ? ` (${object.type})` : ''}: ${object.name ? `\`${object.name}\`${object.parent ? ` on \`${object.parent}\`` : ''}` : cell(object.reason)}${object.note ? ` — ${cell(object.note)}` : ''}`,
    );
  if (file.coverage?.length) {
    const counts = new Map<string, number>();
    for (const entry of file.coverage) {
      const kind = entry.coverage.startsWith('temporary ')
        ? 'on a temporary object'
        : entry.coverage.startsWith('not coverable')
          ? 'not coverable'
          : 'no object: the probe name';
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    lines.push(
      '',
      '## Coverage',
      '',
      [...counts].map(([kind, count]) => `${kind}: ${count}`).join('; '),
      '',
      '| member | where it runs |',
      '|---|---|',
    );
    for (const entry of file.coverage)
      lines.push(`| ${cell(entry.member)} | ${cell(entry.coverage)} |`);
  }
  lines.push('', '## Left behind', '');
  const left = unproven(file.removals);
  if (!file.removals.length) lines.push('Nothing was created.');
  else if (!left.length)
    lines.push(
      `Nothing: all ${file.removals.length} temporary objects removed.`,
    );
  else
    for (const removal of left)
      lines.push(
        `- **${removalWord(removal)}** ${cell(removal.label)}: ${cell(removal.detail)}`,
      );
  lines.push(
    '',
    '## Raw corpora',
    '',
    ...file.corpora.map((f) => `- ${f}`),
    '',
  );
  return lines.join('\n');
}
