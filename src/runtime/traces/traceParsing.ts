/**
 * Turning trace documents into the types `@mcp-abap-adt/interfaces` declares.
 *
 * **This maps; it does not validate.** Validating what SAP sends is not this
 * library's job — the server is the authority on its own documents, and where a
 * check is genuinely needed ADT has an endpoint for it (see
 * `AdtInclude.validate()`, which posts to `/includes/validation`). A parser that
 * also judges the wire ends up asserting things about SAP that nobody measured.
 *
 * An earlier version of this file did exactly that: a `TraceDocumentError`
 * thrown at six levels — document root, rows, fields, nested elements,
 * containers, values — plus an RFC 3339 timestamp validator. Each step had an
 * argument; the sum did not. It also created a failure mode of its own, refusing
 * timestamps a legitimate Atom feed may carry. It is gone.
 *
 * What replaces it is the type contract. If `IAbapTraceStatement.id` is
 * required, that is already a claim, backed by the measurement that every
 * statement carries one; checking it again at runtime is refusing to trust your
 * own contract. Nothing here invents a value the document did not contain —
 * no `?? 0`, no `?? ''`. A field the wire omits arrives as `undefined`, which is
 * the truth about the wire.
 *
 * The element and attribute names are transcribed from measurement. The one
 * genuine uncertainty is the nesting of the feed's `trc:` fields: on the
 * trace-requests feed they sit under `trc:extendedData`, and the traces feed is
 * expected to match, but no raw body of it has been read end to end. So the
 * entry reader looks in both places.
 */

import type {
  IAbapTraceAccessTime,
  IAbapTraceDbAccess,
  IAbapTraceDbAccesses,
  IAbapTraceHitList,
  IAbapTraceHitListEntry,
  IAbapTraceStatement,
  IAbapTraceStatements,
  IAdtResponse,
  INamedItem,
  ITraceEntry,
  ITraceProgramRef,
  ITraceRequestEntry,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function rootOf(response: IAdtResponse, rootName: string): Node {
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

function attrBool(node: Node | undefined, name: string): boolean | undefined {
  const raw = attr(node, name);
  if (raw === undefined) {
    return undefined;
  }
  return raw === 'true' || raw === 'X';
}

const ID_IN_URI = /abaptraces\/([A-Za-z0-9]{16,})(?:\/|$)/;

/**
 * Order two traces by when they were recorded.
 *
 * A comparator, not a validator. Comparing `recordedAt` as a **string** is
 * simply wrong: `2026-08-28T09:00:00Z` is later than
 * `2026-08-28T10:00:00+02:00` and sorts lower as text, so `latestTraceId()` —
 * which exists precisely to avoid taking a stale trace by feed position — would
 * take the stale one. That is a defect in our own logic, independent of what SAP
 * sends.
 *
 * An unreadable timestamp sorts first rather than throwing. This is ordering,
 * not judgement, and `NaN` compares false in both directions, which would leave
 * the order depending on iteration sequence.
 */
export function compareRecordedAt(
  a: { recordedAt: string },
  b: { recordedAt: string },
): number {
  const left = Date.parse(a.recordedAt);
  const right = Date.parse(b.recordedAt);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    if (Number.isNaN(left) && Number.isNaN(right)) {
      return 0;
    }
    return Number.isNaN(left) ? -1 : 1;
  }
  return left - right;
}

/**
 * The traces in a feed.
 *
 * Order is the server's, and **order is not age** — measured, a feed's first
 * entries were minutes old while its last were eight days older. A caller that
 * wants the newest uses {@link compareRecordedAt}.
 */
export function parseTraceEntries(response: IAdtResponse): ITraceEntry[] {
  return asList(rootOf(response, 'feed').entry).map((entry): ITraceEntry => {
    const idText = text(entry.id) ?? '';
    const selfHref =
      asList(entry.link)
        .map((link) => attr(link, 'href') ?? '')
        .find((href) => ID_IN_URI.test(href)) ?? '';

    // See the file comment: the `trc:` fields may sit directly on the entry or
    // under `trc:extendedData`, and only one of those has been read.
    const extended = presentNode(entry.extendedData) ?? {};
    const field = (name: string): unknown => entry[name] ?? extended[name];

    const stateNode = presentNode(field('state'));
    const stateValue = attr(stateNode, 'value');

    return {
      id: (ID_IN_URI.exec(idText)?.[1] ??
        ID_IN_URI.exec(selfHref)?.[1]) as string,
      recordedAt: (text(entry.published) ?? text(entry.updated)) as string,
      user: text(field('user')) ?? text(presentNode(entry.author)?.name),
      objectName: text(field('objectName')),
      uri: idText || selfHref || undefined,
      ...(stateValue !== undefined
        ? { state: { value: stateValue, text: attr(stateNode, 'text') ?? '' } }
        : {}),
      expiresAt: text(field('expiration')) ?? text(field('expires')),
    };
  });
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

export function parseHitList(response: IAdtResponse): IAbapTraceHitList {
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
        grossTime: row.grossTime,
      }),
    ),
  };
}

export function parseStatements(response: IAdtResponse): IAbapTraceStatements {
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
        grossTime: row.grossTime,
        traceEventNetTime: row.traceEventNetTime,
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

export function parseDbAccesses(response: IAdtResponse): IAbapTraceDbAccesses {
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
export function parseNamedItems(response: IAdtResponse): INamedItem[] {
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
export function parseTraceRequests(
  response: IAdtResponse,
): ITraceRequestEntry[] {
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
        isAggregated:
          attrBool(extended, 'isAggregated') ??
          (text(extended.isAggregated) === undefined
            ? undefined
            : text(extended.isAggregated) === 'true'),
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
