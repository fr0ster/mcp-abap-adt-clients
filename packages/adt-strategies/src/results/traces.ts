/**
 * The ABAP profiler's documents, and the trace schedule's.
 *
 * Moved from adt-clients, where `Profiler.list/read` and the executors'
 * trace-scheduling members applied these to every answer. The members answer
 * the document as it came now; a caller who wants the shapes below passes these
 * readings in the result set it constructs the implementation with:
 *
 * ```typescript
 * new Profiler(connection, logger, {
 *   ...profilerDocuments,
 *   list: profilerTraceEntries,
 *   hitlist: profilerHitList,
 * });
 * ```
 *
 * **These map; they do not validate.** Validating what SAP sends is not a
 * reading's job — the server is the authority on its own documents. Nothing
 * here invents a value the document did not contain — no `?? 0`, no `?? ''`.
 * A field the wire omits arrives as `undefined`, which is the truth about the
 * wire, and a body that is empty or not XML reads as no rows rather than
 * throwing: whether that is a failure is the caller's `analyse` to say.
 *
 * **An empty body is not an error here, and this is deliberate.** ADT answers
 * `200` with nothing when the requested documents are not there. A trace view
 * is read-only — nobody PUTs a hit list — so the read-modify-write hazard of an
 * empty `200` elsewhere does not transfer.
 */

import type {
  IResultStrategy,
  ITraceEntry,
  ITraceState,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';

export interface ITraceProgramRef {
  name: string;
  type: string;
  uri: string;
  context?: string;
  byteCodeOffset?: number;
  /** Present on a statement's calling program: a query URI, not a plain URI. */
  objectReferenceQuery?: string;
}

/**
 * `trc:grossTime` and `trc:traceEventNetTime`.
 *
 * Typed from measurement at last. These were `unknown` in 22.0.0 and 23.0.0
 * because the elements had been seen on every row while their attributes had
 * never been captured — the earlier reads were summarised into a table and the
 * bodies discarded. A raw capture settles it: both carry exactly these two, in
 * both the hit list and the statements, with no variant anywhere in the
 * documents read.
 *
 * The **unit of `time` is not established.** The wire says `time="243"` and
 * nothing about what 243 is; `percentage` is of the trace total, which is what
 * makes a row comparable without knowing the unit. Naming it `timeMicros` would
 * be inventing the one thing the measurement did not give.
 */
export interface ITraceTiming {
  /** `time` — the raw figure, in whatever unit the system reports. */
  time: number;
  /** `percentage` of the trace total. */
  percentage: number;
}

/** One row of the hit list. */
export interface IAbapTraceHitListEntry {
  /** Position in the top-down ordering, which is not `index`. */
  topDownIndex?: number;
  index: number;
  hitCount?: number;
  stackCount?: number;
  recursionDepth?: number;
  description?: string;
  /** What a statement's `hitlistAnchor` refers to. */
  proceduralEntryAnchor?: string;
  callingProgram?: ITraceProgramRef;
  calledProgram?: ITraceProgramRef;
  grossTime?: ITraceTiming;
}

/** `trc:hitlist`. */
export interface IAbapTraceHitList {
  entries: IAbapTraceHitListEntry[];
}

/** One traced statement. */
export interface IAbapTraceStatement {
  id: string;
  index: number;
  callLevel?: number;
  text?: string;
  variable?: string;
  package?: string;
  component?: string;
  componentDescription?: string;
  /** Points at a hit list entry's `proceduralEntryAnchor`. */
  hitlistAnchor?: string;
  isProcedureLike?: boolean;
  callingProgram?: ITraceProgramRef;
  grossTime?: ITraceTiming;
  traceEventNetTime?: ITraceTiming;
}

/** `trc:statements` — the large one. */
export interface IAbapTraceStatements {
  statements: IAbapTraceStatement[];
}

/**
 * `trc:accessTime`. Measured, unlike the other two timing elements.
 *
 * `total` splits into `applicationServer` and `database`, and
 * `ratioOfTraceTotal` says how much of the whole trace this one access was —
 * which is the number that finds the offender without reading every row.
 */
export interface IAbapTraceAccessTime {
  total?: number;
  applicationServer?: number;
  database?: number;
  ratioOfTraceTotal?: number;
}

/** One database access. */
export interface IAbapTraceDbAccess {
  index: number;
  tableName?: string;
  /** The SQL, as the trace recorded it. */
  statement?: string;
  type?: string;
  totalCount?: number;
  /** Served from the buffer rather than the database. */
  bufferedCount?: number;
  accessTime?: IAbapTraceAccessTime;
}

/** `trc:dbAccesses`. */
export interface IAbapTraceDbAccesses {
  accesses: IAbapTraceDbAccess[];
}

/**
 * A trace as the `abaptraces` feed describes it.
 *
 * {@link ITraceEntry} is what *every* family can say; this is what the ABAP
 * profiler actually sends, and all of it is transcribed from one raw feed —
 * sixty entries, every field present in every one of them, none of it outside
 * `trc:extendedData`.
 *
 * The fields are required because the wire carried them without exception in
 * the sample. That is a claim, and this is where it is recorded so a later
 * system that omits one can be met by relaxing the type rather than by
 * guessing what happened.
 *
 * Units are deliberately not asserted. `runtime` reads `554` and the document
 * says nothing more; `size` reads `8`. Naming them `runtimeMicros` or
 * `sizeBytes` would add precision the measurement does not contain.
 */
export interface IAbapTraceEntry extends ITraceEntry {
  /** `trc:user`. Also available as `atom:author/atom:name`. */
  user: string;
  /** `trc:objectName` — the generated form, e.g. `ZCL_SOMETHING=========CP`. */
  objectName: string;
  /** `trc:state` — `R`/Finished on every entry read. */
  state: ITraceState;
  /** `trc:expiration`. The system deletes traces; this says when. */
  expiresAt: string;

  /** `trc:system` — the three-character system id. */
  system: string;
  /** `trc:client`. A string: a client is a code, and `010` is not `10`. */
  client: string;
  /** `trc:host` — the application server that recorded it. */
  host: string;

  /** `trc:size`. Unit unstated by the document. */
  size: number;
  /** `trc:runtime`, and the three figures it divides into. Unit unstated. */
  runtime: number;
  runtimeABAP: number;
  runtimeSystem: number;
  runtimeDatabase: number;

  /** `trc:isAggregated` — whether the measurement was aggregated. */
  isAggregated: boolean;
  /** `trc:amdpFileSize`. Zero on every entry read; the field is still there. */
  amdpFileSize: number;
}

/**
 * `trc:executions` — a request's budget and how much of it is spent.
 */
export interface ITraceExecutions {
  /** How many runs this request may measure. */
  maximal?: number;
  /** How many it has measured. */
  completed?: number;
}

/**
 * A scheduled trace request, as the server stores it.
 *
 * Transcribed from a created entry: the identifier, the two catalogue choices
 * echoed back as the same URIs the catalogues hand out, and the link to the
 * trace file once a run has produced one — which is how a scheduled request is
 * connected to the trace it eventually yields.
 *
 * Deliberately no shape for a *submitted* request: the stored entry is
 * measured, the submitted document is not.
 */
export interface ITraceRequestEntry {
  /** `atom:id` — the request's own URI. */
  id: string;
  /** `trc:requestIndex`. */
  index?: number;
  description?: string;
  /** `trc:expires`. A request that is never fulfilled does not live forever. */
  expiresAt?: string;
  isAggregated?: boolean;
  /** `trc:processTypeId`, a URI from `listProcessTypes()`. */
  processTypeId?: string;
  /** `trc:objectTypeId`, a URI from `listObjectTypes()`. */
  objectTypeId?: string;
  /** `trc:executions` — how many runs it may measure, and how many it has. */
  executions?: ITraceExecutions;
  /** The trace this request produced, when it has produced one. */
  traceUri?: string;
}

/**
 * One entry of a trace catalogue — `listObjectTypes()` / `listProcessTypes()`.
 *
 * `name` is a **URI**, not a short code, and it is exactly what a stored trace
 * request echoes back as `trc:processTypeId` / `trc:objectTypeId`.
 */
export interface ITraceCatalogueItem {
  name: string;
  description: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function rootOf(response: IAdtWireResponse, rootName: string): Node {
  const body = typeof response?.data === 'string' ? response.data : '';
  if (!body.trim()) {
    return {};
  }
  try {
    const parsed = parser.parse(body) as Node;
    const root = parsed?.[rootName];
    return root && typeof root === 'object' ? (root as Node) : {};
  } catch {
    return {};
  }
}

/**
 * An element that is present, or `undefined` when the property is absent.
 *
 * A self-closing element (`<trc:callingProgram/>`) parses to the empty
 * **string**, not to an object, so a `typeof value !== 'object'` test would read
 * a present element as a missing one.
 */
function presentNode(value: unknown): Node | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === 'object' ? (value as Node) : {};
}

/** One node, a list of them, or nothing — always answered as a list. */
function asList(value: unknown): Node[] {
  if (Array.isArray(value)) {
    return value.map((item) => presentNode(item) ?? {});
  }
  const node = presentNode(value);
  return node ? [node] : [];
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  // An element with attributes parses to an object whose text is `#text`.
  if (value && typeof value === 'object') {
    const inner = (value as Node)['#text'];
    return typeof inner === 'string' ? inner : undefined;
  }
  return undefined;
}

function attr(node: Node | undefined, name: string): string | undefined {
  const value = node?.[`@_${name}`];
  return typeof value === 'string' ? value : undefined;
}

/** `Number('')` is `0`, so emptiness is checked before conversion. */
function numberOf(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function attrNum(node: Node | undefined, name: string): number | undefined {
  return numberOf(attr(node, name));
}

/**
 * The XML boolean these documents use.
 *
 * One mapper for both spellings of the same field — an attribute
 * (`trc:isProcedureLike="true"`) and an element
 * (`<trc:isAggregated>true</trc:isAggregated>`). They carry the same kind of
 * value and must not disagree about it; before this they did, and the element
 * path answered `false` to anything it did not recognise.
 *
 * **Not `X`.** ABAP's `X`/blank belongs to `asx:abap` payloads — serialised
 * ABAP data, like the lock result or `<CHECK_RESULT>X</CHECK_RESULT>`. ADT's own
 * XML, which these documents are, writes `true`/`false`, and every measured
 * trace body does. Accepting `X` here was speculation about a wire nobody has
 * seen, and it is the kind of guess that makes a mapper disagree with itself.
 *
 * An unrecognised value reads as `undefined`, not `false`: the field is optional
 * and `false` would be a claim about the run. Declining to read is not
 * validation, it is declining to invent.
 */
function booleanOf(raw: string | undefined): boolean | undefined {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return undefined;
}

function attrBool(node: Node | undefined, name: string): boolean | undefined {
  return booleanOf(attr(node, name));
}

/**
 * `trc:grossTime` / `trc:traceEventNetTime`.
 *
 * Both carry `time` and `percentage` and nothing else — measured across a whole
 * hit list and a whole statements document. They were handed through as parsed
 * while the contract typed them `unknown`; now the contract has a shape, so this
 * reads it.
 *
 * The unit of `time` is not ours to name: the wire gives a figure and no unit.
 */
function timing(node: unknown): ITraceTiming | undefined {
  const t = presentNode(node);
  if (!t) {
    return undefined;
  }
  return {
    time: attrNum(t, 'time') as number,
    percentage: attrNum(t, 'percentage') as number,
  };
}

const ID_IN_URI = /abaptraces\/([A-Za-z0-9]{16,})(?:\/|$)/;

/** The fractional digits beyond the millisecond, or '' when there are none. */
const SUB_MILLI = /\.(\d+)/;

/** Seconds field of `60` — the leap second, which POSIX time cannot hold. */
const LEAP_SECOND = /^(.*T\d{2}:\d{2}:)60(\D.*)?$/;

/**
 * Milliseconds, with the one legal form `Date.parse` refuses.
 *
 * `Date.parse('2016-12-31T23:59:60Z')` is `NaN` in Node, because POSIX time has
 * no leap second — but RFC 3339 permits `:60` and Atom is RFC 3339. Left alone,
 * the comparator would file such a trace as unreadable and therefore oldest,
 * when it is in fact the newest possible instant of that minute.
 *
 * So `:60` is ordered as the moment after `:59.999`. This is arithmetic for our
 * own sorting, not a judgement about the value: nothing here decides whether SAP
 * was entitled to send it.
 */
function millisOf(raw: string): number {
  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) {
    return direct;
  }
  const leap = LEAP_SECOND.exec(raw);
  if (leap) {
    const asFiftyNine = Date.parse(`${leap[1]}59${leap[2] ?? ''}`);
    if (!Number.isNaN(asFiftyNine)) {
      return asFiftyNine + 1000;
    }
  }
  return Number.NaN;
}

/**
 * Order two traces by when they were recorded.
 *
 * A comparator, not a validator — this reads the timestamp for our own purpose
 * rather than judging whether SAP was entitled to send it.
 *
 * Two things it must get right, both defects in our own logic and neither about
 * the wire:
 *
 * - **Not as text.** `2026-08-28T09:00:00Z` is later than
 *   `2026-08-28T10:00:00+02:00` and sorts lower as a string, so a caller
 *   picking the newest entry would take the stale one instead.
 * - **Past the millisecond.** `Date.parse` truncates there, so `…00.1001Z` and
 *   `…00.1009Z` come back equal and the older of the two is kept. Removing the
 *   RFC 3339 validator took this fix with it, which it should not have: the
 *   validator was a claim about SAP, this is arithmetic about our own ordering.
 *
 * An unreadable timestamp sorts first rather than throwing. Ordering is not
 * judgement, and `NaN` compares false in both directions, which would otherwise
 * leave the result depending on iteration order.
 */
export function compareRecordedAt(
  a: { recordedAt: string },
  b: { recordedAt: string },
): number {
  const left = millisOf(a.recordedAt);
  const right = millisOf(b.recordedAt);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    if (Number.isNaN(left) && Number.isNaN(right)) {
      return 0;
    }
    return Number.isNaN(left) ? -1 : 1;
  }
  if (left !== right) {
    return left - right;
  }

  // Same millisecond: only digits `Date.parse` discarded can separate them.
  const leftSub = SUB_MILLI.exec(a.recordedAt)?.[1].slice(3) ?? '';
  const rightSub = SUB_MILLI.exec(b.recordedAt)?.[1].slice(3) ?? '';
  const width = Math.max(leftSub.length, rightSub.length);
  return leftSub.padEnd(width, '0').localeCompare(rightSub.padEnd(width, '0'));
}

/**
 * The traces in a feed.
 *
 * Order is the server's, and **order is not age** — measured, a feed's first
 * entries were minutes old while its last were eight days older. A caller that
 * wants the newest sorts with {@link compareRecordedAt}.
 */
function readTraceEntries(response: IAdtWireResponse): IAbapTraceEntry[] {
  return asList(rootOf(response, 'feed').entry).map(
    (entry): IAbapTraceEntry => {
      const idText = text(entry.id) ?? '';
      const selfHref =
        asList(entry.link)
          .map((link) => attr(link, 'href') ?? '')
          .find((href) => ID_IN_URI.test(href)) ?? '';

      // Under `trc:extendedData`, and only there. The reader used to look on
      // the entry as well, because which of the two nestings was real had never
      // been read end to end. It has been now: sixty entries, every `trc:` field
      // inside the container and not one outside it. The tolerance was a
      // placeholder for a measurement, and the measurement arrived.
      const ext = presentNode(entry.extendedData) ?? {};
      const stateNode = presentNode(ext.state);

      return {
        id: (ID_IN_URI.exec(idText)?.[1] ??
          ID_IN_URI.exec(selfHref)?.[1]) as string,
        recordedAt: (text(entry.published) ?? text(entry.updated)) as string,
        uri: idText || selfHref || undefined,

        // `atom:author/atom:name` carries the same name and is the fallback the
        // feed itself offers.
        user: (text(ext.user) ??
          text(presentNode(entry.author)?.name)) as string,
        objectName: text(ext.objectName) as string,
        state: {
          value: attr(stateNode, 'value') as string,
          text: attr(stateNode, 'text') as string,
        },
        expiresAt: text(ext.expiration) as string,

        system: text(ext.system) as string,
        // Codes, not counts. A client is `010` and an instance is `00`; the
        // leading zero is significant and `Number('010')` destroys it
        // irreversibly. Only what is actually counted is a number below.
        client: text(ext.client) as string,
        host: text(ext.host) as string,

        size: numberOf(text(ext.size)) as number,
        runtime: numberOf(text(ext.runtime)) as number,
        runtimeABAP: numberOf(text(ext.runtimeABAP)) as number,
        runtimeSystem: numberOf(text(ext.runtimeSystem)) as number,
        runtimeDatabase: numberOf(text(ext.runtimeDatabase)) as number,

        isAggregated: booleanOf(text(ext.isAggregated)) as boolean,
        amdpFileSize: numberOf(text(ext.amdpFileSize)) as number,
      };
    },
  );
}

/** `trc:callingProgram` / `trc:calledProgram`. */
function programRef(node: unknown): ITraceProgramRef | undefined {
  const ref = presentNode(node);
  if (!ref) {
    return undefined;
  }
  return {
    name: attr(ref, 'name') as string,
    type: attr(ref, 'type') as string,
    uri: attr(ref, 'uri') as string,
    context: attr(ref, 'context'),
    byteCodeOffset: attrNum(ref, 'byteCodeOffset'),
    objectReferenceQuery: attr(ref, 'objectReferenceQuery'),
  };
}

function readHitList(response: IAdtWireResponse): IAbapTraceHitList {
  return {
    entries: asList(rootOf(response, 'hitlist').entry).map(
      (row): IAbapTraceHitListEntry => ({
        topDownIndex: attrNum(row, 'topDownIndex'),
        index: attrNum(row, 'index') as number,
        hitCount: attrNum(row, 'hitCount'),
        stackCount: attrNum(row, 'stackCount'),
        recursionDepth: attrNum(row, 'recursionDepth'),
        description: attr(row, 'description'),
        proceduralEntryAnchor: attr(row, 'proceduralEntryAnchor'),
        callingProgram: programRef(row.callingProgram),
        calledProgram: programRef(row.calledProgram),
        grossTime: timing(row.grossTime),
      }),
    ),
  };
}

function readStatements(response: IAdtWireResponse): IAbapTraceStatements {
  return {
    statements: asList(rootOf(response, 'statements').statement).map(
      (row): IAbapTraceStatement => ({
        id: attr(row, 'id') as string,
        index: attrNum(row, 'index') as number,
        callLevel: attrNum(row, 'callLevel'),
        text: attr(row, 'text'),
        variable: attr(row, 'variable'),
        package: attr(row, 'package'),
        component: attr(row, 'component'),
        componentDescription: attr(row, 'componentDescription'),
        hitlistAnchor: attr(row, 'hitlistAnchor'),
        isProcedureLike: attrBool(row, 'isProcedureLike'),
        callingProgram: programRef(row.callingProgram),
        grossTime: timing(row.grossTime),
        traceEventNetTime: timing(row.traceEventNetTime),
      }),
    ),
  };
}

function accessTime(node: unknown): IAbapTraceAccessTime | undefined {
  const time = presentNode(node);
  if (!time) {
    return undefined;
  }
  return {
    total: attrNum(time, 'total'),
    applicationServer: attrNum(time, 'applicationServer'),
    database: attrNum(time, 'database'),
    ratioOfTraceTotal: attrNum(time, 'ratioOfTraceTotal'),
  };
}

function readDbAccesses(response: IAdtWireResponse): IAbapTraceDbAccesses {
  return {
    accesses: asList(rootOf(response, 'dbAccesses').dbAccess).map(
      (row): IAbapTraceDbAccess => ({
        index: attrNum(row, 'index') as number,
        tableName: attr(row, 'tableName'),
        statement: attr(row, 'statement'),
        type: attr(row, 'type'),
        totalCount: attrNum(row, 'totalCount'),
        bufferedCount: attrNum(row, 'bufferedCount'),
        accessTime: accessTime(row.accessTime),
      }),
    ),
  };
}

/**
 * A `nameditem:namedItemList` — the shape both trace catalogues answer with.
 *
 * Measured: `nameditem:name` is a **URI**, not a short code, and it is exactly
 * what a stored trace request echoes back as `trc:processTypeId` /
 * `trc:objectTypeId`. Renaming it here would hide that they are the same string.
 */
function readCatalogue(response: IAdtWireResponse): ITraceCatalogueItem[] {
  return asList(rootOf(response, 'namedItemList').namedItem).map((item) => ({
    name: text(item.name) as string,
    description: text(item.description) as string,
  }));
}

/**
 * The schedule: trace requests as the server stores them.
 *
 * An empty feed means nothing is scheduled — this collection is consumed by the
 * runs that fulfil it — NOT that the endpoint is broken.
 */
function readTraceRequests(response: IAdtWireResponse): ITraceRequestEntry[] {
  return asList(rootOf(response, 'feed').entry).map(
    (entry): ITraceRequestEntry => {
      const extended = presentNode(entry.extendedData) ?? {};
      const executions = presentNode(extended.executions);
      const traceUri = asList(entry.link)
        .filter((link) => (attr(link, 'rel') ?? '').endsWith('/tracefile'))
        .map((link) => attr(link, 'href'))
        .find((href): href is string => Boolean(href));

      return {
        id: text(entry.id) as string,
        index: numberOf(text(extended.requestIndex)),
        description: text(extended.description),
        expiresAt: text(extended.expires),
        // Attribute or element — the same mapper, so the two spellings of one
        // field cannot disagree about it.
        isAggregated:
          attrBool(extended, 'isAggregated') ??
          booleanOf(text(extended.isAggregated)),
        processTypeId: attr(presentNode(extended.processType), 'processTypeId'),
        objectTypeId: attr(presentNode(extended.object), 'objectTypeId'),
        ...(executions
          ? {
              executions: {
                maximal: attrNum(executions, 'maximal'),
                completed: attrNum(executions, 'completed'),
              },
            }
          : {}),
        traceUri,
      };
    },
  );
}

/**
 * The request id out of a scheduled measurement's `Location`.
 *
 * The id appears only there: reading the created resource back answers `200`
 * with an **empty body**, measured. A `Location` that is absent reads as `''`
 * rather than throwing — that SAP did not say is the caller's to judge, through
 * `analyse`, which sees the same answer.
 */
function readProfilerId(response: IAdtWireResponse): string {
  const headers = response?.headers as
    | Record<string, string | string[] | undefined>
    | undefined;
  const location =
    headers?.location ??
    headers?.Location ??
    headers?.['content-location'] ??
    headers?.['Content-Location'];
  if (typeof location !== 'string' || !location.trim()) {
    return '';
  }
  const value = location.trim();
  if (value.startsWith('/')) {
    return value;
  }
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

/** The `abaptraces` feed, read as its traces — `Profiler.list`. */
export const profilerTraceEntries: IResultStrategy<IAbapTraceEntry[]> = (
  answer,
) => readTraceEntries(answer);

/** `trc:hitlist` — the `hitlist` view of `Profiler.read`. */
export const profilerHitList: IResultStrategy<IAbapTraceHitList> = (answer) =>
  readHitList(answer);

/** `trc:statements` — the `statements` view of `Profiler.read`. */
export const profilerStatements: IResultStrategy<IAbapTraceStatements> = (
  answer,
) => readStatements(answer);

/** `trc:dbAccesses` — the `dbAccesses` view of `Profiler.read`. */
export const profilerDbAccesses: IResultStrategy<IAbapTraceDbAccesses> = (
  answer,
) => readDbAccesses(answer);

/**
 * A trace catalogue — what `listObjectTypes()` and `listProcessTypes()` answer,
 * a `nameditem:namedItemList`.
 */
export const traceSchedulingTypes: IResultStrategy<ITraceCatalogueItem[]> = (
  answer,
) => readCatalogue(answer);

/** The schedule — `listRequests()` and `getRequestsByUri()`. */
export const traceSchedulingRequests: IResultStrategy<ITraceRequestEntry[]> = (
  answer,
) => readTraceRequests(answer);

/** The request id `scheduleTrace()` was answered with, or `''`. */
export const traceSchedulingProfilerId: IResultStrategy<string> = (answer) =>
  readProfilerId(answer);
