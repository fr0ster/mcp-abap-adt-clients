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
  textFrom,
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
  if (status === 401 || status === 403)
    return {
      go: false,
      exitCode: 2,
      line: `Oops: no authorization (${status})`,
    };
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
  /** `skipped: <reason>`: the row was not sent. */
  skipped?: string;
  /** Sent again: what its envelope answered first. */
  inEnvelope?: string;
  /** Split out of a poisoned envelope: the depth and the envelope path it was settled at. */
  settled?: { depth: number; path: string };
  /** A single call whose own 500 poisoned its group: the cause of a poisoning. */
  poisonCause?: boolean;
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
}

const SAP_PREFIX = 'SAP refused the request: ';

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
      accept: unique([...fromText, ...row.named.supportedAccept]),
      contentType: [],
    };
  if (row.status === 415)
    return {
      accept: [],
      contentType: unique([...fromText, ...row.named.supportedContentType]),
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
  if (row.status === undefined)
    return {
      verdict: 'unknown',
      reason: `no answer: ${row.failure ?? 'nothing came back'}`,
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
      : `${name}: ${verdict.verdict} (${verdict.status})`;

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
  const missing = new Map<string, ICorpusRow>();
  for (const row of [...rows, ...evidence])
    if (isAcceptHeaderMissing(row) && !missing.has(needsKey(row)))
      missing.set(needsKey(row), row);
  const out: IEndpointNeeds[] = [];
  for (const [endpoint, pair] of by) {
    let accept = judge(pair.accept, 406);
    const absent = missing.get(endpoint);
    if (accept.verdict !== 'checked' && absent)
      accept = {
        verdict: 'checked',
        status: 400,
        reason: '400 acceptHeaderMissing without Accept',
      };
    const contentType = pair.contentType
      ? judge(pair.contentType, 415)
      : pair.accept?.skipped
        ? judge(pair.accept, 415)
        : ({ verdict: 'no body' } as IHeaderVerdict);
    const a = accept.verdict === 'checked';
    const c = contentType.verdict === 'checked';
    const detail = [
      verdictText('Accept', accept),
      verdictText('Content-Type', contentType),
    ].join('; ');
    const needs: Needs =
      a && c
        ? 'both'
        : a
          ? 'accept'
          : c
            ? 'content-type'
            : accept.verdict === 'not checked' &&
                (contentType.verdict === 'not checked' ||
                  contentType.verdict === 'no body')
              ? 'neither'
              : 'unknown';
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
      `- ${removal.removed ? 'removed' : '**NOT REMOVED**'}: ${cell(removal.label)} — ${cell(removal.detail)}`,
    );
  const left = corpus.removals.filter((removal) => !removal.removed);
  if (left.length)
    lines.push(
      '',
      `**${left.length} object(s) could not be removed; delete them by hand.**`,
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
      .filter((c) => c.headers === 'none')
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
            .filter((c) => c.source === corpus.source && c.headers === 'none')
            .flatMap((c) => c.rows),
        ),
      ),
      '',
    );
  return lines.join('\n');
}
