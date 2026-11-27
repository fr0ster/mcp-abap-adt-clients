/**
 * Plain string scanners, one per regex they replaced (#304, spec section 3.7).
 *
 * Each answers exactly what its regex answered on every input — leftmost
 * match, greedy runs, backtracking where the pattern had it — and nothing
 * looser. The differential tests (`__tests__/scan*.test.ts`) hold each against
 * its regex on SAP's recorded texts, hand-written edges, every short string
 * over the pattern's characters and seeded random ones.
 */

/** The end of the run of characters from `from` that are none of `stops`. */
function runEnd(text: string, from: number, stops: string): number {
  let end = from;
  while (end < text.length && !stops.includes(text.charAt(end))) end++;
  return end;
}

/**
 * The id after the first `prefix` that one or more non-`/` characters follow:
 * `/\/runs\/([^/]+)/` for `prefix` `/runs/`, and the same for any other
 * literal prefix. `undefined` when there is none.
 */
export function runIdAfter(text: string, prefix: string): string | undefined {
  let at = text.indexOf(prefix);
  while (at !== -1) {
    const from = at + prefix.length;
    const end = runEnd(text, from, '/');
    if (end > from) return text.slice(from, end);
    at = text.indexOf(prefix, at + 1);
  }
  return undefined;
}

const AUNIT_RUN = '<aunit:run';
const URI_OPEN = 'uri="';

/** The value of a `uri="…"` at `at`: non-empty, up to its closing `"`. */
function quotedValueAt(text: string, at: number): string | undefined {
  const from = at + URI_OPEN.length;
  const close = text.indexOf('"', from);
  return close > from ? text.slice(from, close) : undefined;
}

/**
 * Each `uri="` inside one `<aunit:run` before its first `>`, the last first —
 * the order the greedy `[^>]*` of `<aunit:run[^>]*uri="` tries them in.
 */
function* runUrisFromLast(text: string, run: number): Generator<number> {
  const start = run + AUNIT_RUN.length;
  const gt = text.indexOf('>', start);
  const limit = gt === -1 ? text.length : gt;
  let at = limit > start ? text.lastIndexOf(URI_OPEN, limit - 1) : -1;
  while (at >= start) {
    yield at;
    at = text.lastIndexOf(URI_OPEN, at - 1);
  }
}

/** Each `<aunit:run`, left to right. */
function* aunitRuns(text: string): Generator<number> {
  let at = text.indexOf(AUNIT_RUN);
  while (at !== -1) {
    yield at;
    at = text.indexOf(AUNIT_RUN, at + 1);
  }
}

/**
 * `/<aunit:run[^>]*uri="([^"]+)"/`: the uri of the first `<aunit:run` that
 * has one, taking the last `uri="` before the element's first `>` that a
 * non-empty value and `"` follow — the value may cross a `>`, as `[^"]` does.
 */
export function aunitRunUri(text: string): string | undefined {
  for (const run of aunitRuns(text))
    for (const at of runUrisFromLast(text, run)) {
      const value = quotedValueAt(text, at);
      if (value !== undefined) return value;
    }
  return undefined;
}

/** `/uri="([^"]+)"/`: the first `uri="` that a non-empty value and `"` follow. */
export function quotedUri(text: string): string | undefined {
  let at = text.indexOf(URI_OPEN);
  while (at !== -1) {
    const value = quotedValueAt(text, at);
    if (value !== undefined) return value;
    at = text.indexOf(URI_OPEN, at + 1);
  }
  return undefined;
}

/**
 * `/<aunit:run[^>]*uri="[^"]*\/runs\/[^/"]+/.test`: some `uri="` of some
 * `<aunit:run` whose value, up to its first `"` or the end, holds `/runs/`
 * and then a character that is neither `/` nor `"`.
 */
export function aunitRunUriHasRunId(text: string): boolean {
  for (const run of aunitRuns(text))
    for (const at of runUrisFromLast(text, run)) {
      const from = at + URI_OPEN.length;
      const close = text.indexOf('"', from);
      const end = close === -1 ? text.length : close;
      let runs = text.indexOf('/runs/', from);
      while (runs !== -1 && runs < end) {
        const after = runs + '/runs/'.length;
        if (after < end && text.charAt(after) !== '/') return true;
        runs = text.indexOf('/runs/', runs + 1);
      }
    }
  return false;
}

/** Whether every character is one of the ASCII digits `\d` names. */
function allDigits(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return false;
  }
  return true;
}

const T100_VALUE = 'T100KEY-V';

/** `/^T100KEY-V\d+$/.test`: `T100KEY-V` and then one or more ASCII digits. */
export function isT100ValueKey(key: string): boolean {
  return (
    key.startsWith(T100_VALUE) &&
    key.length > T100_VALUE.length &&
    allDigits(key.slice(T100_VALUE.length))
  );
}

/**
 * One code unit folded as a non-Unicode `/i` regex folds it (ECMAScript
 * `Canonicalize`): its upper case when that is one code unit, except that a
 * non-ASCII character never folds to an ASCII one.
 */
function folded(c: string): string {
  const upper = c.toUpperCase();
  if (upper.length !== 1) return c;
  if (c.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128) return c;
  return upper;
}

/** Whether `literal` stands at `at`, compared as `/i` compares. */
function foldedAt(text: string, at: number, literal: string): boolean {
  if (at + literal.length > text.length) return false;
  for (let i = 0; i < literal.length; i++)
    if (folded(text.charAt(at + i)) !== folded(literal.charAt(i))) return false;
  return true;
}

const MESSAGE_CLASS = '/messageclass/';
const MESSAGES = '/messages/';

/**
 * `/\/messageclass\/([^/]+)\/messages\/([^/?]+)/i`: from the leftmost
 * `/messageclass/` (folded) that one id segment, `/messages/` (folded) and a
 * non-empty number free of `/` and `?` follow — the two still encoded.
 */
export function messageClassKey(
  href: string,
): { id: string; no: string } | undefined {
  for (let at = 0; at + MESSAGE_CLASS.length <= href.length; at++) {
    if (!foldedAt(href, at, MESSAGE_CLASS)) continue;
    const idFrom = at + MESSAGE_CLASS.length;
    const idEnd = runEnd(href, idFrom, '/');
    if (idEnd === idFrom || !foldedAt(href, idEnd, MESSAGES)) continue;
    const noFrom = idEnd + MESSAGES.length;
    const noEnd = runEnd(href, noFrom, '/?');
    if (noEnd > noFrom)
      return { id: href.slice(idFrom, idEnd), no: href.slice(noFrom, noEnd) };
  }
  return undefined;
}

/** `text.replace(/&amp;/g, '&')`. */
export function unescapedAmpersands(text: string): string {
  return text.replaceAll('&amp;', '&');
}

/** `text.replace(/\/+$/, '')`: the text without the `/` characters it ends in. */
export function withoutTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === '/') end--;
  return text.slice(0, end);
}

function isAsciiDigit(c: string): boolean {
  return c.length === 1 && allDigits(c);
}

function isAsciiAlphanumeric(c: string): boolean {
  const code = c.charCodeAt(0);
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
}

const ABAPTRACES = 'abaptraces/';

/**
 * `/abaptraces\/([A-Za-z0-9]{16,})(?:\/|$)/`: after the leftmost
 * `abaptraces/` that works, the whole run of ASCII letters and digits — at
 * least 16, and followed by `/` or the end. A shorter part of the run is
 * followed by another letter or digit, so backtracking finds nothing more.
 */
export function traceIdIn(uri: string): string | undefined {
  let at = uri.indexOf(ABAPTRACES);
  while (at !== -1) {
    const from = at + ABAPTRACES.length;
    let end = from;
    while (end < uri.length && isAsciiAlphanumeric(uri.charAt(end))) end++;
    if (end - from >= 16 && (end === uri.length || uri.charAt(end) === '/'))
      return uri.slice(from, end);
    at = uri.indexOf(ABAPTRACES, at + 1);
  }
  return undefined;
}

/** `/\.(\d+)/`: the digits after the first `.` that one or more follow. */
export function subMilliDigits(text: string): string | undefined {
  let at = text.indexOf('.');
  while (at !== -1) {
    let end = at + 1;
    while (end < text.length && isAsciiDigit(text.charAt(end))) end++;
    if (end > at + 1) return text.slice(at + 1, end);
    at = text.indexOf('.', at + 1);
  }
  return undefined;
}

/** The line terminators a regex `.` does not match. */
function hasLineTerminator(text: string): boolean {
  return (
    text.includes('\n') ||
    text.includes('\r') ||
    text.includes(' ') ||
    text.includes(' ')
  );
}

/** Whether `Tdd:dd:60` stands at `at`. */
function leapSecondAt(text: string, at: number): boolean {
  const digitsAt = [1, 2, 4, 5];
  return (
    text.charAt(at) === 'T' &&
    digitsAt.every((i) => isAsciiDigit(text.charAt(at + i))) &&
    text.charAt(at + 3) === ':' &&
    text.charAt(at + 6) === ':' &&
    text.startsWith('60', at + 7)
  );
}

/**
 * `/^(.*T\d{2}:\d{2}:)60(\D.*)?$/`: the last `T` (the greedy `.*`) such that
 * no line terminator precedes it, `dd:dd:60` follows, and then either the end
 * or a non-digit and a rest with no line terminator. `head` is up to the
 * seconds' `:`, `tail` what follows the `60` (absent when nothing does).
 */
export function leapSecondParts(
  text: string,
): { head: string; tail: string | undefined } | undefined {
  for (
    let at = text.lastIndexOf('T');
    at !== -1;
    at = text.lastIndexOf('T', at - 1)
  ) {
    if (leapSecondAt(text, at) && !hasLineTerminator(text.slice(0, at))) {
      const rest = text.slice(at + 9);
      if (rest === '') return { head: text.slice(0, at + 7), tail: undefined };
      if (!isAsciiDigit(rest.charAt(0)) && !hasLineTerminator(rest.slice(1)))
        return { head: text.slice(0, at + 7), tail: rest };
    }
    if (at === 0) break;
  }
  return undefined;
}
