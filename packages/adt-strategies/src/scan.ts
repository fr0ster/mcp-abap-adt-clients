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
