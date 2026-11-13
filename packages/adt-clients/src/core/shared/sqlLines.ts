/**
 * A freestyle SQL statement laid out on lines of at most 72 characters.
 *
 * **Why.** The freestyle data preview (`/datapreview/freestyle`) keeps the first
 * 255 characters of each line of the statement and drops the rest of the line
 * without a word (measured on premise, mcp-abap-adt#350): a string literal that
 * crosses the mark is refused as "longer than 255 characters", and a condition
 * past it is silently lost — the query answers rows the caller did not ask for.
 * A statement whose lines are short is read whole.
 *
 * **What is changed.** Only where whitespace is: a line whose code is longer
 * than {@link SQL_LINE_WIDTH} is broken at a run of blanks (the run replaced by
 * one LF) or right after a comma (an LF inserted), taking the last such point at
 * or before the width, else the first after it. Never inside a `'…'` or
 * `` `…` `` literal (a literal is never cut, whatever its length), never inside
 * a `"` comment, never before a `*` (the line would become a comment line) or a
 * comment (it would leave its line), never among a line's leading blanks. A
 * token with no break point within the width goes on a line of its own, as it
 * is. A comment that ends a line is not counted and is left where it is.
 *
 * **What is not.** A statement whose every line fits is returned as the same
 * string. Nothing is refused: a literal longer than 255 characters, a `"` inside
 * a literal, are sent as they are, and SAP's answer is the caller's.
 *
 * One pass over the statement in plain code; no regular expression.
 */

/** The width a line's code is wrapped to. */
export const SQL_LINE_WIDTH = 72;

/** Where the scanner is: in code, or inside a literal (which a line break does not end). */
type ScanState = 'code' | 'quote' | 'backtick';

/** A place a line may be broken: the output line ends at `end`, the next starts at `resume`. */
interface BreakPoint {
  end: number;
  resume: number;
}

/** What one physical line of the statement holds. */
interface ScannedLine {
  /** Where the line's code ends: at its comment, or at its line break. */
  codeEnd: number;
  /** Where the next physical line starts (after this one's line break). */
  next: number;
  /** In order of position. */
  breakPoints: BreakPoint[];
  /** The state the next line starts in. */
  state: ScanState;
}

function isBlank(ch: string): boolean {
  return ch === ' ' || ch === '\t';
}

/** The length of the line break at `at` (LF, CR, CRLF), or 0. */
function lineBreakAt(text: string, at: number): number {
  const ch = text.charAt(at);
  if (ch === '\n') return 1;
  if (ch === '\r') return text.charAt(at + 1) === '\n' ? 2 : 1;
  return 0;
}

/** The index of the next line break at or after `from`, or the end. */
function lineEnd(text: string, from: number): number {
  let at = from;
  while (at < text.length && lineBreakAt(text, at) === 0) at += 1;
  return at;
}

/** May an output line start at `at`: code that is neither `*` nor a comment? */
function mayStartLine(text: string, at: number): boolean {
  if (at >= text.length || lineBreakAt(text, at) > 0) return false;
  const ch = text.charAt(at);
  return !isBlank(ch) && ch !== '*' && ch !== '"';
}

function scanLine(
  text: string,
  start: number,
  startState: ScanState,
): ScannedLine {
  let state = startState;
  const breakPoints: BreakPoint[] = [];
  if (state === 'code') {
    let first = start;
    while (first < text.length && isBlank(text.charAt(first))) first += 1;
    if (text.charAt(first) === '*') {
      const end = lineEnd(text, first);
      return {
        codeEnd: start,
        next: end + lineBreakAt(text, end),
        breakPoints,
        state,
      };
    }
  }
  // A line that starts inside a literal starts with code already.
  let seenCode = state !== 'code';
  let codeEnd = -1;
  let at = start;
  while (at < text.length && lineBreakAt(text, at) === 0) {
    const ch = text.charAt(at);
    if (state !== 'code') {
      const delimiter = state === 'quote' ? "'" : '`';
      if (ch === delimiter) {
        if (text.charAt(at + 1) === delimiter) {
          at += 2;
          continue;
        }
        state = 'code';
      }
      at += 1;
      continue;
    }
    if (ch === '"') {
      codeEnd = at;
      at = lineEnd(text, at);
      break;
    }
    if (isBlank(ch)) {
      const runStart = at;
      while (at < text.length && isBlank(text.charAt(at))) at += 1;
      if (seenCode && mayStartLine(text, at)) {
        breakPoints.push({ end: runStart, resume: at });
      }
      continue;
    }
    seenCode = true;
    if (ch === "'") state = 'quote';
    else if (ch === '`') state = 'backtick';
    else if (ch === ',' && mayStartLine(text, at + 1)) {
      breakPoints.push({ end: at + 1, resume: at + 1 });
    }
    at += 1;
  }
  return {
    codeEnd: codeEnd < 0 ? at : codeEnd,
    next: at + lineBreakAt(text, at),
    breakPoints,
    state,
  };
}

/**
 * The statement with every line whose code is longer than
 * {@link SQL_LINE_WIDTH} wrapped; the same string when every line fits.
 */
export function wrapSqlLines(statement: string): string {
  const parts: string[] = [];
  let wrapped = false;
  let state: ScanState = 'code';
  let start = 0;
  while (start < statement.length) {
    const line = scanLine(statement, start, state);
    let from = start;
    let next = 0;
    while (line.codeEnd - from > SQL_LINE_WIDTH) {
      // The last break point within the width; else the first beyond it.
      let chosen: BreakPoint | undefined;
      let index = next;
      for (; index < line.breakPoints.length; index += 1) {
        const point = line.breakPoints[index];
        if (point === undefined) break;
        if (point.end - from <= SQL_LINE_WIDTH) {
          chosen = point;
          continue;
        }
        if (chosen === undefined) {
          chosen = point;
          index += 1;
        }
        break;
      }
      if (chosen === undefined) break;
      parts.push(statement.slice(from, chosen.end), '\n');
      wrapped = true;
      from = chosen.resume;
      next = index;
    }
    parts.push(statement.slice(from, line.next));
    state = line.state;
    start = line.next;
  }
  return wrapped ? parts.join('') : statement;
}
