/**
 * Turning trace documents into the types `@mcp-abap-adt/interfaces` declares.
 *
 * **What is verified and what is not.** The element and attribute *names* below
 * are transcribed from measurement — they are the ones the contract was built
 * from. What is NOT verified is the exact nesting of the feed's `trc:` fields:
 * on the trace-requests feed they sit under `trc:extendedData`, and the traces
 * feed is expected to match, but no raw body of it has been read end to end.
 *
 * So the entry reader looks in both places rather than guessing one. That is a
 * deliberate tolerance, not sloppiness: guessing the wrong nesting yields a
 * silently empty field, and a trace listing that quietly loses `user` and
 * `state` is worse than one that fails. When the probe returns raw bodies, the
 * tolerance can collapse to whichever branch is real.
 *
 * **The tolerance stops at the shape.** Being unsure which of two nestings holds
 * a field is not the same as being willing to accept any document at all — and
 * the check runs at two levels, because a wrong guess hides at both. A root
 * that is not the expected one throws; so does a recognised root whose rows are
 * named something else, or a feed of entries none of which carries a readable
 * id. Only a document understood at both levels may report an empty result.
 * A body that is empty, unparseable, or rooted in something other than what is
 * expected throws {@link TraceDocumentError} — it does NOT become an empty
 * result. An earlier version returned `{ entries: [] }` for all three, which a
 * caller reads as "this trace is empty" and an `Array.isArray` assertion
 * happily confirms. Since this file admits the exact shape is unverified, a
 * wrong guess must be loud: it is the one failure most likely to actually
 * happen here.
 *
 * Timing elements are handed over as parsed, because
 * {@link import('@mcp-abap-adt/interfaces').ITraceTiming} is `unknown`: their
 * attributes were never captured, and this layer does not invent names the
 * contract refused to invent.
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

/**
 * A trace document could not be read.
 *
 * Thrown rather than absorbed, because the alternative is worse than a crash:
 * an unreadable body used to become `{ entries: [] }`, which a caller reads as
 * "this trace is empty" and a test satisfies with `Array.isArray`. A profiler
 * that silently reports no rows is the failure it exists to detect.
 */
export class TraceDocumentError extends Error {
  constructor(
    message: string,
    readonly body: string,
  ) {
    super(message);
    this.name = 'TraceDocumentError';
  }
}

function bodyOf(response: IAdtResponse): string {
  return typeof response?.data === 'string' ? response.data : '';
}

/** Enough of the body to recognise it, without pasting a 1.3MB view into a log. */
function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}

/**
 * The expected root of a trace document, or a thrown explanation.
 *
 * Three ways this can fail, and none of them may pass for an empty result:
 *
 * - **An empty body.** ADT answers `200` with nothing when an object is not
 *   ready yet — measured, and it never 404s. An empty *feed* is a document with
 *   a root and no entries, so emptiness of content is still distinguishable
 *   from emptiness of body.
 * - **Unparseable XML.** Truncation, an HTML error page, anything.
 * - **A document with a different root.** This is the one that matters most
 *   here: this file admits the traces feed's exact nesting was never read end
 *   to end, so being wrong is a live possibility rather than a theoretical one.
 *   If the shape is not what this code expects, the caller must hear about it.
 */
function rootOf(response: IAdtResponse, rootName: string, what: string): Node {
  const body = bodyOf(response);
  if (!body.trim()) {
    throw new TraceDocumentError(
      `Empty body reading ${what} (HTTP ${response?.status}). ADT answers 200 with an empty body when a resource is not ready — that is not the same as an empty result, so it is reported rather than parsed into one.`,
      body,
    );
  }

  let parsed: Node;
  try {
    parsed = parser.parse(body) as Node;
  } catch (error) {
    throw new TraceDocumentError(
      `Unparseable XML reading ${what}: ${error instanceof Error ? error.message : String(error)}. Body began: ${excerpt(body)}`,
      body,
    );
  }

  // Presence of the key, not truthiness of its value: a self-closing
  // `<trc:hitlist/>` — a genuinely empty view, which the server does send —
  // parses to the empty string, and rejecting that would refuse the very
  // document this check exists to let through.
  if (!parsed || !(rootName in parsed)) {
    throw new TraceDocumentError(
      `Reading ${what}: expected a <${rootName}> document, got ${describeRoots(parsed)}. Body began: ${excerpt(body)}`,
      body,
    );
  }
  const root = parsed[rootName];
  return root && typeof root === 'object' ? (root as Node) : {};
}

/** Child *elements* of a node — not its attributes, not its text. */
function childElements(node: Node): string[] {
  return Object.keys(node).filter(
    (key) => !key.startsWith('@_') && key !== '#text',
  );
}

/**
 * The rows of a view, or a thrown explanation.
 *
 * A recognised root with unrecognised rows is the same defect as an
 * unrecognised root, one level down, and it hides in the same way: a view whose
 * children are named something other than what this code expects yields an
 * empty list that reads as "this trace has no rows". Since the exact row schema
 * of the three views has never been confirmed against a raw capture, that is
 * the live risk here rather than a hypothetical one.
 *
 * A root with no child elements at all is genuinely empty and passes.
 */
function rowsOf(
  root: Node,
  rowName: string,
  what: string,
  response: IAdtResponse,
): Node[] {
  const rows = asList(root[rowName]);
  if (rows.length > 0) {
    return rows;
  }
  const others = childElements(root).filter((name) => name !== rowName);
  if (others.length > 0) {
    throw new TraceDocumentError(
      `Reading ${what}: expected <${rowName}> rows, found <${others.join('>, <')}>. The document was understood at the root and not below it, so an empty result would be a guess.`,
      bodyOf(response),
    );
  }
  return rows;
}

/** What the document actually had at the top, for the error to name. */
function describeRoots(parsed: Node | undefined): string {
  const names = Object.keys(parsed ?? {}).filter((k) => k !== '?xml');
  return names.length > 0 ? `<${names.join('>, <')}>` : 'no elements';
}

/** One node, a list of them, or nothing — always answered as a list. */
function asList(value: unknown): Node[] {
  if (Array.isArray(value)) {
    return value as Node[];
  }
  return value && typeof value === 'object' ? [value as Node] : [];
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

function attrNum(node: Node | undefined, name: string): number | undefined {
  const raw = attr(node, name);
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function attrBool(node: Node | undefined, name: string): boolean | undefined {
  const raw = attr(node, name);
  return raw === undefined ? undefined : raw === 'true' || raw === 'X';
}

/** A count as text, or nothing. `Number('')` is `0`, so emptiness is checked. */
function numberOf(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const ID_IN_URI = /abaptraces\/([A-Za-z0-9]{16,})(?:\/|$)/;

/**
 * The traces in a feed.
 *
 * Order is the server's, and **order is not age** — measured, a feed's first
 * entries were minutes old while its last were eight days older. A caller that
 * wants the newest compares `recordedAt`; a caller that wants its own run's
 * trace compares against the ids it saw before running.
 */
export function parseTraceEntries(response: IAdtResponse): ITraceEntry[] {
  const feed = rootOf(response, 'feed', 'the trace feed');
  // A feed legitimately carries `title`, `updated` and `contributor` with no
  // entries at all, so the absence of `entry` is emptiness, not a misread. What
  // is NOT emptiness is entries that are present and unreadable.
  const entries = asList(feed.entry);

  const parsed = entries
    .map((entry): ITraceEntry | undefined => {
      const idText = text(entry.id) ?? '';
      const selfHref =
        asList(entry.link)
          .map((link) => attr(link, 'href') ?? '')
          .find((href) => ID_IN_URI.test(href)) ?? '';
      const id = ID_IN_URI.exec(idText)?.[1] ?? ID_IN_URI.exec(selfHref)?.[1];
      if (!id) {
        return undefined;
      }

      // See the file comment: the `trc:` fields may sit directly on the entry
      // or under `trc:extendedData`, and only one of those has been read.
      const extended = (entry.extendedData as Node | undefined) ?? {};
      const field = (name: string): unknown => entry[name] ?? extended[name];

      const stateNode = field('state');
      const stateValue = attr(stateNode as Node | undefined, 'value');
      const stateText = attr(stateNode as Node | undefined, 'text');

      return {
        id,
        recordedAt: text(entry.published) ?? text(entry.updated) ?? '',
        user:
          text(field('user')) ?? text((entry.author as Node | undefined)?.name),
        objectName: text(field('objectName')),
        uri: idText || selfHref || undefined,
        ...(stateValue !== undefined
          ? { state: { value: stateValue, text: stateText ?? '' } }
          : {}),
        expiresAt: text(field('expiration')) ?? text(field('expires')),
      };
    })
    .filter((entry): entry is ITraceEntry => entry !== undefined);

  if (entries.length > 0 && parsed.length === 0) {
    throw new TraceDocumentError(
      `Reading the trace feed: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} present and none carried a recognisable trace id. Returning an empty list here would report a full feed as no traces at all.`,
      bodyOf(response),
    );
  }
  return parsed;
}

/** `trc:callingProgram` / `trc:calledProgram`. */
function programRef(node: unknown): ITraceProgramRef | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const ref = node as Node;
  const name = attr(ref, 'name');
  const type = attr(ref, 'type');
  const uri = attr(ref, 'uri');
  if (name === undefined && type === undefined && uri === undefined) {
    return undefined;
  }
  return {
    name: name ?? '',
    type: type ?? '',
    uri: uri ?? '',
    context: attr(ref, 'context'),
    byteCodeOffset: attrNum(ref, 'byteCodeOffset'),
    objectReferenceQuery: attr(ref, 'objectReferenceQuery'),
  };
}

export function parseHitList(response: IAdtResponse): IAbapTraceHitList {
  const what = 'a trace hit list';
  const rows = rowsOf(
    rootOf(response, 'hitlist', what),
    'entry',
    what,
    response,
  );

  return {
    entries: rows.map(
      (row): IAbapTraceHitListEntry => ({
        topDownIndex: attrNum(row, 'topDownIndex'),
        index: attrNum(row, 'index') ?? 0,
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
  const what = 'trace statements';
  const rows = rowsOf(
    rootOf(response, 'statements', what),
    'statement',
    what,
    response,
  );

  return {
    statements: rows.map(
      (row): IAbapTraceStatement => ({
        id: attr(row, 'id') ?? '',
        index: attrNum(row, 'index') ?? 0,
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
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const time = node as Node;
  return {
    total: attrNum(time, 'total'),
    applicationServer: attrNum(time, 'applicationServer'),
    database: attrNum(time, 'database'),
    ratioOfTraceTotal: attrNum(time, 'ratioOfTraceTotal'),
  };
}

export function parseDbAccesses(response: IAdtResponse): IAbapTraceDbAccesses {
  const what = 'trace database accesses';
  const rows = rowsOf(
    rootOf(response, 'dbAccesses', what),
    'dbAccess',
    what,
    response,
  );

  return {
    accesses: rows.map(
      (row): IAbapTraceDbAccess => ({
        index: attrNum(row, 'index') ?? 0,
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
 * `trc:objectTypeId`. That is why the contract calls the field `name` and not
 * `id`: renaming it here would hide the fact that the two are the same string.
 */
export function parseNamedItems(response: IAdtResponse): INamedItem[] {
  const what = 'a trace catalogue';
  const items = rowsOf(
    rootOf(response, 'namedItemList', what),
    'namedItem',
    what,
    response,
  );

  return items.map((item) => ({
    name: text(item.name) ?? '',
    description: text(item.description) ?? '',
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
  const entries = asList(rootOf(response, 'feed', 'the trace schedule').entry);
  // Same rule as the trace feed: an empty schedule is a feed with no entries,
  // not a feed of entries this code cannot read.
  if (entries.length > 0 && !entries.some((entry) => text(entry.id))) {
    throw new TraceDocumentError(
      `Reading the trace schedule: ${entries.length} entries present and none carried an id.`,
      bodyOf(response),
    );
  }

  return entries.map((entry): ITraceRequestEntry => {
    const extended = (entry.extendedData as Node | undefined) ?? {};
    const executions = extended.executions as Node | undefined;
    const traceUri = asList(entry.link)
      .filter((link) => (attr(link, 'rel') ?? '').endsWith('/tracefile'))
      .map((link) => attr(link, 'href'))
      .find((href): href is string => Boolean(href));

    return {
      id: text(entry.id) ?? '',
      index: numberOf(text(extended.requestIndex)),
      description: text(extended.description),
      expiresAt: text(extended.expires),
      isAggregated: text(extended.isAggregated) === 'true',
      processTypeId: attr(
        extended.processType as Node | undefined,
        'processTypeId',
      ),
      objectTypeId: attr(extended.object as Node | undefined, 'objectTypeId'),
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
  });
}
