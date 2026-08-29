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
 * the check runs at all three levels, because a wrong guess hides at every one
 * of them:
 *
 * 1. **Document.** A body that is empty, unparseable, or rooted in something
 *    other than what is expected.
 * 2. **Row.** A recognised root whose children are named something else, and a
 *    feed entry — any entry, not merely all of them — that cannot be read.
 * 3. **Field.** A row missing something the contract requires. `?? 0` and
 *    `?? ''` were one hiding place: they turned `<statement/>` into a
 *    statement with `id: ''` and `index: 0`, a row that was never in the
 *    document and one that `typeof id === 'string'` confirms.
 * 4. **Nested element.** A present element that
 *    could not be read was treated as an absent one, because
 *    `<trc:callingProgram/>` parses to the empty *string* and a
 *    `typeof !== 'object'` test called that missing. Absence is the property
 *    not being there; anything else is present. See {@link presentNode}.
 * 5. **Container.** A present element that yields none of the members this
 *    parser knows — `<extendedData/>`, `<executions/>`, `<processType/>`. It
 *    looks exactly like optional metadata that happened to be absent, and is
 *    not. See {@link readAll}.
 * 6. **Value.** A recognised field whose *content* is not understood. Reading
 *    every unrecognised boolean as `false`, or dropping an unreadable number as
 *    though the field were absent, is not a parse failure — it is a statement
 *    about the object, made on the strength of not understanding the document.
 *    See {@link booleanOf}, {@link numberOf} and {@link timestampOf}. Three
 *    rounds separated those: the boolean case was fixed, the numeric one four
 *    lines away was not, and the timestamp — the only kind feeding a
 *    *comparison* — went another round after that.
 *
 * The list is a list, not a running total. Four earlier commits each called the
 * level they had just fixed the last one; a further one turned up every time.
 *
 * **The rules live in helpers so they can be applied by search, not by memory.**
 * {@link presentNode}, {@link readAll}, {@link required} and {@link booleanOf}
 * exist because the same defect kept reappearing at a call site the previous
 * fix had not visited — once in a function written for that very purpose, three
 * call sites away. Adding a reader here means using them; `as Node | undefined`
 * and `?? ''` in this file are how the last eight review rounds started.
 *
 * Only a document understood at all three may report an empty result. What
 * stays tolerant is deliberately narrow and named: the two *optional* fields
 * whose nesting is unverified, `user` and `state`, are looked for in both
 * places. Optional means a family may not have it; required means the document
 * is not what this code thinks it is.
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

/**
 * A required field, or a thrown explanation.
 *
 * `?? 0` and `?? ''` were the last hiding place: a `<statement/>` with nothing
 * in it came back as a statement with `id: ''` and `index: 0`, which is a
 * fabricated row wearing the shape of a real one. A test asserting
 * `typeof id === 'string'` passes on the fabrication, which is how it survived.
 *
 * Note that *present and empty* is not missing: an empty element parses to the
 * empty string, so `description=""` is a value and only absence throws.
 */
function required<T>(
  value: T | undefined,
  field: string,
  rowName: string,
  index: number,
  what: string,
  response: IAdtResponse,
): T {
  if (value === undefined) {
    throw new TraceDocumentError(
      `Reading ${what}: <${rowName}> at position ${index} is missing ${field}, which the contract requires. A default here would hand back a row that was never in the document.`,
      bodyOf(response),
    );
  }
  return value;
}

/**
 * An element that is present, or `undefined` when the property is absent.
 *
 * The distinction the parser kept getting wrong: `<trc:callingProgram/>` parses
 * to the empty **string**, so a `typeof value !== 'object'` test read a present
 * element as a missing one and dropped it without a word. Absence is the
 * property not being there at all; everything else is present, and a present
 * element this code cannot read is a document it does not understand.
 */
function presentNode(value: unknown): Node | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === 'object' ? (value as Node) : {};
}

/**
 * A present element must yield something, or the document was not understood.
 *
 * The counterpart to {@link presentNode}: that one decides whether an element
 * is there, this one decides whether being there meant anything. Handing back
 * an object of `undefined`s is how a container nobody could read passes for a
 * container that happened to be empty.
 */
function readAll<T extends Record<string, unknown>>(
  parsed: T,
  element: string,
  members: string,
  what: string,
  response: IAdtResponse,
): T {
  if (Object.values(parsed).every((value) => value === undefined)) {
    throw new TraceDocumentError(
      `Reading ${what}: a <${element}> element is present and carries none of ${members}.`,
      bodyOf(response),
    );
  }
  return parsed;
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

/**
 * One node, a list of them, or nothing — always answered as a list.
 *
 * A self-closing element (`<trc:statement/>`) parses to the empty string, not
 * to an object. Discarding it would drop a row that IS in the document, which
 * is the silence this file spent five review rounds removing — so it becomes an
 * empty node, and whatever required fields it lacks are reported by name.
 */
function asList(value: unknown): Node[] {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === 'object' ? (item as Node) : {},
    );
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [typeof value === 'object' ? (value as Node) : {}];
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

/**
 * A number, or a thrown explanation — never a quietly missing field.
 *
 * `Number.isNaN(x) ? undefined : x` reads `hitCount="unexpected"` as "this row
 * has no hit count", which is a statement about the trace made on the strength
 * of not understanding it — the same defect {@link booleanOf} was written for,
 * left in the numeric path because I fixed the case I was shown.
 *
 * Non-finite is refused too: `Number('Infinity')` is not `NaN`, so an infinite
 * hit count would otherwise sail through as a measurement.
 */
function numberOf(
  raw: string | undefined,
  field: string,
  what: string,
  response: IAdtResponse,
): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new TraceDocumentError(
      `Reading ${what}: ${field} is "${raw}", which is not a finite number. Dropping the field would report the row as not carrying a value it plainly does.`,
      bodyOf(response),
    );
  }
  return parsed;
}

/**
 * RFC 3339, as Atom requires — not "whatever `Date.parse` will swallow".
 *
 * `Date.parse` is not a validator. It accepts `2026-02-30T10:00:00Z` and
 * silently rolls it to March 2; it accepts a date with no time, and a time with
 * **no offset**, which it then reads in the *process's* timezone — so the same
 * feed would parse differently on two machines. Atom timestamps are RFC 3339
 * date-times: full date, full time, explicit offset.
 *
 * Returns the epoch milliseconds and any fractional digits beyond the third,
 * because those are needed to order two traces written within the same
 * millisecond and are exactly what `Date.parse` throws away.
 */
const RFC3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

interface IInstant {
  ms: number;
  /** Digits after the millisecond, exactly as written. */
  subMilli: string;
}

function parseRfc3339(raw: string): IInstant | undefined {
  const match = RFC3339.exec(raw);
  if (!match) {
    return undefined;
  }
  const [, y, mo, d, h, mi, sec, fraction = '', zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(sec);

  // Calendar validity: `Date.UTC` rolls 30 February into March rather than
  // refusing it, so the only way to catch it is to read the components back.
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return undefined;
  }

  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 23 || offsetMins > 59) {
      return undefined;
    }
    offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  }

  const milli = Number(fraction.slice(0, 3).padEnd(3, '0') || '0');
  return {
    ms: utc - offsetMinutes * 60_000 + milli,
    subMilli: fraction.slice(3),
  };
}

/**
 * A timestamp, validated but returned as written.
 *
 * The contract types these as strings and that stays true — a caller comparing
 * two of them wants the server's own text back, not a reformatted version.
 */
function timestampOf(
  raw: string | undefined,
  field: string,
  what: string,
  response: IAdtResponse,
): string | undefined {
  if (raw === undefined || raw === '') {
    return undefined;
  }
  if (!parseRfc3339(raw)) {
    throw new TraceDocumentError(
      `Reading ${what}: ${field} is "${raw}", which is not an RFC 3339 date-time (Atom requires a full date, a full time and an explicit offset). Carrying it would let it be compared against real ones and win.`,
      bodyOf(response),
    );
  }
  return raw;
}

/**
 * Order two traces by when they were recorded.
 *
 * A comparator rather than a number, because no single JavaScript number holds
 * this: epoch milliseconds are ~1.7e12, which leaves a double too few digits
 * for sub-millisecond fractions. `Date.parse` truncates at the millisecond, so
 * `…:00.1001Z` and `…:00.1009Z` compare equal through it and `latestTraceId()`
 * would keep whichever it happened to see first.
 *
 * Safe by construction: the parser refuses any timestamp it cannot read, so
 * every `recordedAt` reaching here is a valid RFC 3339 date-time.
 */
export function compareRecordedAt(
  a: { recordedAt: string },
  b: { recordedAt: string },
): number {
  const left = parseRfc3339(a.recordedAt);
  const right = parseRfc3339(b.recordedAt);
  if (!left || !right) {
    // Unreachable through the parser; a direct caller gets a stable order
    // rather than a silent wrong one.
    throw new Error(
      `compareRecordedAt received an unparseable timestamp: "${!left ? a.recordedAt : b.recordedAt}"`,
    );
  }
  if (left.ms !== right.ms) {
    return left.ms - right.ms;
  }
  const width = Math.max(left.subMilli.length, right.subMilli.length);
  return left.subMilli
    .padEnd(width, '0')
    .localeCompare(right.subMilli.padEnd(width, '0'));
}

function attrNum(
  node: Node | undefined,
  name: string,
  what: string,
  response: IAdtResponse,
): number | undefined {
  return numberOf(attr(node, name), name, what, response);
}

/**
 * A boolean, or a thrown explanation — never a quiet `false`.
 *
 * `raw === 'true'` reads every unrecognised value as `false`, which is not a
 * failure to parse but a *statement about the object*: it says aggregation was
 * off, or the statement is not procedure-like, on the strength of not
 * understanding the document. Absence stays absent; an unexpected value is a
 * document this code does not understand.
 *
 * Both conventions are accepted because both appear in ADT: XML booleans
 * (`true`/`false`) and ABAP flags (`X`/empty).
 */
function booleanOf(
  raw: string | undefined,
  field: string,
  what: string,
  response: IAdtResponse,
): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === 'true' || raw === 'X') {
    return true;
  }
  if (raw === 'false' || raw === '') {
    return false;
  }
  throw new TraceDocumentError(
    `Reading ${what}: ${field} is "${raw}", which is neither a boolean (true/false) nor an ABAP flag (X/empty). Reading it as false would state something about the object that the document does not.`,
    bodyOf(response),
  );
}

function attrBool(
  node: Node | undefined,
  name: string,
  what: string,
  response: IAdtResponse,
): boolean | undefined {
  return booleanOf(attr(node, name), name, what, response);
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

  return entries.map((entry, position): ITraceEntry => {
    const idText = text(entry.id) ?? '';
    const selfHref =
      asList(entry.link)
        .map((link) => attr(link, 'href') ?? '')
        .find((href) => ID_IN_URI.test(href)) ?? '';
    const id = required(
      ID_IN_URI.exec(idText)?.[1] ?? ID_IN_URI.exec(selfHref)?.[1],
      'a recognisable trace id',
      'entry',
      position,
      'the trace feed',
      response,
    );

    // See the file comment: the `trc:` fields may sit directly on the entry
    // or under `trc:extendedData`, and only one of those has been read.
    // `?? {}` alone does not do this: a present-but-empty `<extendedData/>`
    // parses to the empty string, which is not nullish, so every lookup on it
    // came back undefined and the fields vanished without a word.
    const extendedNode = presentNode(entry.extendedData);
    const extended = extendedNode ?? {};
    const field = (name: string): unknown => entry[name] ?? extended[name];

    // A container that is there and yields nothing was not understood. The
    // check is on the `trc:` fields specifically, not on `user` — that one
    // falls back to `atom:author`, so it can resolve while `extendedData`
    // remains a mystery. Fields sitting directly on the entry still satisfy it:
    // which of the two nestings is real is the one thing this file does not
    // claim to know, and this must not decide it.
    if (
      extendedNode &&
      field('user') === undefined &&
      field('objectName') === undefined &&
      field('state') === undefined &&
      field('expiration') === undefined &&
      field('expires') === undefined
    ) {
      throw new TraceDocumentError(
        `Reading the trace feed: <entry> at position ${position} has an <extendedData> element carrying none of user/objectName/state/expiration.`,
        bodyOf(response),
      );
    }

    const stateNode = presentNode(field('state'));
    const stateValue = attr(stateNode, 'value');
    const stateText = attr(stateNode, 'text');
    if (stateNode && stateValue === undefined) {
      throw new TraceDocumentError(
        `Reading the trace feed: <entry> at position ${position} has a state element with no value. A trace's lifecycle is what tells "it exists" from "it is readable", so an unreadable state cannot be dropped.`,
        bodyOf(response),
      );
    }

    return {
      id,
      recordedAt: required(
        timestampOf(
          text(entry.published) ?? text(entry.updated),
          'published',
          'the trace feed',
          response,
        ),
        'a timestamp',
        'entry',
        position,
        'the trace feed',
        response,
      ),
      user: text(field('user')) ?? text(presentNode(entry.author)?.name),
      objectName: text(field('objectName')),
      uri: idText || selfHref || undefined,
      // `state` is optional, but its two members are not: an element that is
      // there with a value and no text is half-understood, and `text: ''` would
      // present that as a state whose description happens to be blank.
      ...(stateValue !== undefined
        ? {
            state: {
              value: stateValue,
              text: required(
                stateText,
                'a state text',
                'entry',
                position,
                'the trace feed',
                response,
              ),
            },
          }
        : {}),
      expiresAt: timestampOf(
        text(field('expiration')) ?? text(field('expires')),
        'expiration',
        'the trace feed',
        response,
      ),
    };
  });
}

/**
 * `trc:callingProgram` / `trc:calledProgram`.
 *
 * Absent entirely is fine — not every row names a program. A program element
 * that is present but missing one of the three the contract requires is not:
 * filling the gap with `''` invents a reference to a program called nothing.
 */
function programRef(
  node: unknown,
  what: string,
  response: IAdtResponse,
): ITraceProgramRef | undefined {
  const ref = presentNode(node);
  if (!ref) {
    return undefined;
  }
  const name = attr(ref, 'name');
  const type = attr(ref, 'type');
  const uri = attr(ref, 'uri');
  if (name === undefined || type === undefined || uri === undefined) {
    throw new TraceDocumentError(
      `Reading ${what}: a program reference is present but carries only some of name/type/uri (${[name && 'name', type && 'type', uri && 'uri'].filter(Boolean).join(', ') || 'none of them'}). An element that is there and unreadable is not the same as one that is absent.`,
      bodyOf(response),
    );
  }
  return {
    name,
    type,
    uri,
    context: attr(ref, 'context'),
    byteCodeOffset: attrNum(ref, 'byteCodeOffset', what, response),
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
      (row, position): IAbapTraceHitListEntry => ({
        topDownIndex: attrNum(row, 'topDownIndex', what, response),
        index: required(
          attrNum(row, 'index', what, response),
          'an index',
          'entry',
          position,
          what,
          response,
        ),
        hitCount: attrNum(row, 'hitCount', what, response),
        stackCount: attrNum(row, 'stackCount', what, response),
        recursionDepth: attrNum(row, 'recursionDepth', what, response),
        description: attr(row, 'description'),
        proceduralEntryAnchor: attr(row, 'proceduralEntryAnchor'),
        callingProgram: programRef(row.callingProgram, what, response),
        calledProgram: programRef(row.calledProgram, what, response),
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
      (row, position): IAbapTraceStatement => ({
        id: required(
          attr(row, 'id'),
          'an id',
          'statement',
          position,
          what,
          response,
        ),
        index: required(
          attrNum(row, 'index', what, response),
          'an index',
          'statement',
          position,
          what,
          response,
        ),
        callLevel: attrNum(row, 'callLevel', what, response),
        text: attr(row, 'text'),
        variable: attr(row, 'variable'),
        package: attr(row, 'package'),
        component: attr(row, 'component'),
        componentDescription: attr(row, 'componentDescription'),
        hitlistAnchor: attr(row, 'hitlistAnchor'),
        isProcedureLike: attrBool(row, 'isProcedureLike', what, response),
        callingProgram: programRef(row.callingProgram, what, response),
        grossTime: row.grossTime,
        traceEventNetTime: row.traceEventNetTime,
      }),
    ),
  };
}

function accessTime(
  node: unknown,
  what: string,
  response: IAdtResponse,
): IAbapTraceAccessTime | undefined {
  const time = presentNode(node);
  if (!time) {
    return undefined;
  }
  // Every member is optional, so none can be required individually — but an
  // element that yields not one of the four was not understood at all.
  return readAll(
    {
      total: attrNum(time, 'total', what, response),
      applicationServer: attrNum(time, 'applicationServer', what, response),
      database: attrNum(time, 'database', what, response),
      ratioOfTraceTotal: attrNum(time, 'ratioOfTraceTotal', what, response),
    },
    'accessTime',
    'total/applicationServer/database/ratioOfTraceTotal',
    what,
    response,
  );
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
      (row, position): IAbapTraceDbAccess => ({
        index: required(
          attrNum(row, 'index', what, response),
          'an index',
          'dbAccess',
          position,
          what,
          response,
        ),
        tableName: attr(row, 'tableName'),
        statement: attr(row, 'statement'),
        type: attr(row, 'type'),
        totalCount: attrNum(row, 'totalCount', what, response),
        bufferedCount: attrNum(row, 'bufferedCount', what, response),
        accessTime: accessTime(row.accessTime, what, response),
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

  return items.map((item, position) => ({
    name: required(
      text(item.name),
      'a name',
      'namedItem',
      position,
      what,
      response,
    ),
    description: required(
      text(item.description),
      'a description',
      'namedItem',
      position,
      what,
      response,
    ),
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
  return entries.map((entry, position): ITraceRequestEntry => {
    const extendedNode = presentNode(entry.extendedData);
    const extended = extendedNode ?? {};
    const executions = presentNode(extended.executions);
    const processType = presentNode(extended.processType);
    const object = presentNode(extended.object);
    const traceUri = asList(entry.link)
      .filter((link) => (attr(link, 'rel') ?? '').endsWith('/tracefile'))
      .map((link) => attr(link, 'href'))
      .find((href): href is string => Boolean(href));

    // Same rule as the feed: present and yielding nothing is not understood.
    // Here there is no ambiguity to protect — the schedule entry's shape was
    // read from a raw capture — so every field this parser knows is checked.
    if (
      extendedNode &&
      [
        extended.description,
        extended.expires,
        extended.isAggregated,
        extended.requestIndex,
        extended.processType,
        extended.object,
        extended.executions,
      ].every((value) => value === undefined)
    ) {
      throw new TraceDocumentError(
        `Reading the trace schedule: <entry> at position ${position} has an <extendedData> element carrying none of description/expires/isAggregated/requestIndex/processType/object/executions.`,
        bodyOf(response),
      );
    }

    return {
      id: required(
        text(entry.id),
        'an id',
        'entry',
        position,
        'the trace schedule',
        response,
      ),
      index: numberOf(
        text(extended.requestIndex),
        'requestIndex',
        'the trace schedule',
        response,
      ),
      description: text(extended.description),
      expiresAt: timestampOf(
        text(extended.expires),
        'expires',
        'the trace schedule',
        response,
      ),
      // Absence is not `false`. The contract makes this optional, and saying
      // "aggregation was off" because the field was missing is a claim about
      // the run that the document never made.
      isAggregated: booleanOf(
        text(extended.isAggregated),
        'isAggregated',
        'the trace schedule',
        response,
      ),
      processTypeId: processType
        ? readAll(
            { processTypeId: attr(processType, 'processTypeId') },
            'processType',
            'processTypeId',
            'the trace schedule',
            response,
          ).processTypeId
        : undefined,
      objectTypeId: object
        ? readAll(
            { objectTypeId: attr(object, 'objectTypeId') },
            'object',
            'objectTypeId',
            'the trace schedule',
            response,
          ).objectTypeId
        : undefined,
      ...(executions
        ? {
            executions: readAll(
              {
                maximal: attrNum(
                  executions,
                  'maximal',
                  'the trace schedule',
                  response,
                ),
                completed: attrNum(
                  executions,
                  'completed',
                  'the trace schedule',
                  response,
                ),
              },
              'executions',
              'maximal/completed',
              'the trace schedule',
              response,
            ),
          }
        : {}),
      traceUri,
    };
  });
}
