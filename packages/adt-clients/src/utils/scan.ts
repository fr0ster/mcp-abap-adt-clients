/**
 * Plain string scanners, one per regex they replaced (#304, spec section 3.7).
 *
 * Each answers exactly what its regex answered on every input — leftmost
 * match, greedy runs, backtracking where the pattern had it — and nothing
 * looser. The differential tests (`__tests__/unit/scan/*.test.ts`) hold each
 * against its regex on SAP's recorded texts, hand-written edges, every short
 * string over the pattern's characters and seeded random ones.
 */

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

/** Whether `c` is an ASCII digit, `\d`. */
function isDigit(c: string): boolean {
  return c.length === 1 && c >= '0' && c <= '9';
}

/** The characters of ECMAScript `\s`: white space and line terminators. */
const WHITE_SPACE = new Set([
  '\t',
  '\n',
  '\v',
  '\f',
  '\r',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  ' ',
  '　',
  '﻿',
]);

function isWhiteSpace(c: string): boolean {
  return WHITE_SPACE.has(c);
}

/** The length of the `\r?\n` at `at`: 2, 1, or 0 when there is none. */
function newlineAt(text: string, at: number): number {
  if (text.charAt(at) === '\r' && text.charAt(at + 1) === '\n') return 2;
  return text.charAt(at) === '\n' ? 1 : 0;
}

/**
 * What `(?:^|\r?\n)` can match at `at`, in the order the alternation tries:
 * nothing at the start, then a line break.
 */
function leadsAt(text: string, at: number): number[] {
  const leads: number[] = at === 0 ? [0] : [];
  const newline = newlineAt(text, at);
  if (newline > 0) leads.push(newline);
  return leads;
}

/**
 * `/boundary=(?:"([^"]+)"|([^;\s]+))/i`: after the leftmost folded
 * `boundary=` that works, a quoted non-empty value, else a non-empty run of
 * characters that are neither `;` nor `\s`.
 */
export function multipartBoundary(contentType: string): string | undefined {
  const marker = 'boundary=';
  for (let at = 0; at + marker.length <= contentType.length; at++) {
    if (!foldedAt(contentType, at, marker)) continue;
    const from = at + marker.length;
    if (contentType.charAt(from) === '"') {
      const close = contentType.indexOf('"', from + 1);
      if (close > from + 1) return contentType.slice(from + 1, close);
    }
    let end = from;
    while (
      end < contentType.length &&
      contentType.charAt(end) !== ';' &&
      !isWhiteSpace(contentType.charAt(end))
    )
      end++;
    if (end > from) return contentType.slice(from, end);
  }
  return undefined;
}

/** One delimiter line: where it starts, how long it is, and whether it closes. */
export interface IDelimiterLine {
  readonly index: number;
  readonly length: number;
  readonly closing: boolean;
}

/** The delimiter line of `boundary` whose match starts at `at`, if any. */
function delimiterAt(
  body: string,
  at: number,
  dashes: string,
): IDelimiterLine | undefined {
  for (const lead of leadsAt(body, at)) {
    let end = at + lead;
    if (!body.startsWith(dashes, end)) continue;
    end += dashes.length;
    // The greedy `(--)?` takes a closing `--` when it is there; giving it back
    // leaves `-`, which no line break or end follows, so that is all.
    const closing = body.startsWith('--', end);
    let tail = end + (closing ? 2 : 0);
    while (body.charAt(tail) === ' ' || body.charAt(tail) === '\t') tail++;
    const ending = newlineAt(body, tail);
    if (ending > 0 || tail === body.length)
      return { index: at, length: tail + ending - at, closing };
  }
  return undefined;
}

/**
 * The delimiter lines of `boundary`, left to right without overlap, as
 * `body.matchAll(/(?:^|\r?\n)--B(--)?[ \t]*(?:\r?\n|$)/g)` found them: from
 * the start or after `\n` or `\r\n`, `--` and the boundary as written, an
 * optional closing `--`, spaces or tabs, then a line break or the end.
 */
export function delimiterLines(
  body: string,
  boundary: string,
): IDelimiterLine[] {
  const dashes = `--${boundary}`;
  const lines: IDelimiterLine[] = [];
  let at = 0;
  while (at <= body.length) {
    const line = delimiterAt(body, at, dashes);
    if (line) {
      lines.push(line);
      at = line.index + line.length;
    } else at++;
  }
  return lines;
}

/** An inner status line: where its match ends, the code and the reason. */
export interface IStatusLine {
  readonly end: number;
  readonly status: string;
  readonly reason: string;
}

/** The status line whose match starts at `at`, if any. */
function statusLineAt(part: string, at: number): IStatusLine | undefined {
  for (const lead of leadsAt(part, at)) {
    let p = at + lead;
    if (!part.startsWith('HTTP/1.', p)) continue;
    p += 'HTTP/1.'.length;
    if (!isDigit(part.charAt(p))) continue;
    p++;
    const spaces = p;
    while (isWhiteSpace(part.charAt(p))) p++;
    if (p === spaces) continue;
    const code = part.slice(p, p + 3);
    if (code.length !== 3 || ![...code].every(isDigit)) continue;
    p += 3;
    // `\s*` greedy, given back one character at a time, then `[^\r\n]*`
    // greedy and a line break.
    let most = p;
    while (isWhiteSpace(part.charAt(most))) most++;
    for (let k = most; k >= p; k--) {
      let e = k;
      while (
        e < part.length &&
        part.charAt(e) !== '\r' &&
        part.charAt(e) !== '\n'
      )
        e++;
      const ending = newlineAt(part, e);
      if (ending > 0)
        return { end: e + ending, status: code, reason: part.slice(k, e) };
    }
  }
  return undefined;
}

/**
 * `/(?:^|\r?\n)HTTP\/1\.\d\s+(\d{3})\s*([^\r\n]*)\r?\n/.exec(part)`: the first
 * inner status line — from the start or after a line break, `HTTP/1.`, a
 * digit, white space, three digits, white space (given back as the regex gives
 * it back), the rest of the line and a line break.
 */
export function innerStatusLine(part: string): IStatusLine | undefined {
  for (let at = 0; at < part.length; at++) {
    const line = statusLineAt(part, at);
    if (line) return line;
  }
  return undefined;
}

/**
 * `/^(?:\r?\n)|\r?\n\r?\n/.exec(rest)`: a line break at the very start, else
 * the first blank line — its index and length, or `undefined`.
 */
export function headerBodySplit(
  rest: string,
): { index: number; length: number } | undefined {
  for (let at = 0; at < rest.length; at++) {
    if (at === 0) {
      const first = newlineAt(rest, 0);
      if (first > 0) return { index: 0, length: first };
    }
    const a = newlineAt(rest, at);
    if (a === 0) continue;
    const b = newlineAt(rest, at + a);
    if (b > 0) return { index: at, length: a + b };
  }
  return undefined;
}

/** `text.split(/\r?\n/)`: split on `\n`, a `\r` before it removed. */
export function lines(text: string): string[] {
  const pieces = text.split('\n');
  return pieces.map((piece, i) =>
    i < pieces.length - 1 && piece.endsWith('\r') ? piece.slice(0, -1) : piece,
  );
}
