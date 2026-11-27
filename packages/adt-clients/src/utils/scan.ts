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

/** Whether `c` is a word character, `\w`. */
function isWord(c: string): boolean {
  return (
    c.length === 1 &&
    ((c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '_')
  );
}

function isLetter(c: string): boolean {
  return c.length === 1 && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
}

/** `\b` between `at - 1` and `at`. */
function wordBoundary(text: string, at: number): boolean {
  return isWord(text.charAt(at - 1)) !== isWord(text.charAt(at));
}

/**
 * `<` + letter + `[\w-]*` + `suffix` at `at` (the run greedy; giving it back
 * leaves a word character or `-` where `suffix` begins): the end of `suffix`.
 */
function prefixedNameAt(
  text: string,
  at: number,
  open: string,
  suffix: string,
): { prefixEnd: number; end: number } | undefined {
  if (!text.startsWith(open, at)) return undefined;
  let p = at + open.length;
  if (!isLetter(text.charAt(p))) return undefined;
  p++;
  while (isWord(text.charAt(p)) || text.charAt(p) === '-') p++;
  if (!text.startsWith(suffix, p)) return undefined;
  return { prefixEnd: p, end: p + suffix.length };
}

/**
 * Every `/<[A-Za-z][\w-]*:type\b[^>]*?\/>/g` tag, left to right without
 * overlap: a prefixed `type` tag name, a word boundary, then the nearest `/>`
 * with no `>` before it.
 */
export function typeTags(text: string): { index: number; end: number }[] {
  const tags: { index: number; end: number }[] = [];
  let at = 0;
  while (at < text.length) {
    const name = prefixedNameAt(text, at, '<', ':type');
    let end: number | undefined;
    if (name && wordBoundary(text, name.end)) {
      for (let i = name.end; i < text.length; i++) {
        if (text.startsWith('/>', i)) {
          end = i + 2;
          break;
        }
        if (text.charAt(i) === '>') break;
      }
    }
    if (end === undefined) at++;
    else {
      tags.push({ index: at, end });
      at = end;
    }
  }
  return tags;
}

/** Each tag of `text` replaced by what `replace` makes of it, as `String.replace` with `/g`. */
export function replaceTypeTags(
  text: string,
  replace: (tag: string) => string,
): string {
  let out = '';
  let from = 0;
  for (const { index, end } of typeTags(text)) {
    out += text.slice(from, index) + replace(text.slice(index, end));
    from = end;
  }
  return out + text.slice(from);
}

/** `/\bname="([^"]*)"/`: the value of the first `name="…"` after a word boundary. */
export function nameAttribute(tag: string): string | undefined {
  for (
    let at = tag.indexOf('name="');
    at !== -1;
    at = tag.indexOf('name="', at + 1)
  ) {
    if (!wordBoundary(tag, at)) continue;
    const close = tag.indexOf('"', at + 'name="'.length);
    if (close !== -1) return tag.slice(at + 'name="'.length, close);
  }
  return undefined;
}

/** `/\bisSelected="(?:true|false)"/`: where the first one stands, and its length. */
export function isSelectedAttribute(
  tag: string,
): { index: number; length: number } | undefined {
  const marker = 'isSelected="';
  for (
    let at = tag.indexOf(marker);
    at !== -1;
    at = tag.indexOf(marker, at + 1)
  ) {
    if (!wordBoundary(tag, at)) continue;
    const from = at + marker.length;
    for (const value of ['true"', 'false"'])
      if (tag.startsWith(value, from))
        return { index: at, length: marker.length + value.length };
  }
  return undefined;
}

/** `/<([A-Za-z][\w-]*:type)\b/`: where the first prefixed `type` name ends. */
export function typeTagNameEnd(
  tag: string,
): { index: number; end: number } | undefined {
  for (let at = tag.indexOf('<'); at !== -1; at = tag.indexOf('<', at + 1)) {
    const name = prefixedNameAt(tag, at, '<', ':type');
    if (name && wordBoundary(tag, name.end))
      return { index: at, end: name.end };
  }
  return undefined;
}

/** `text.replace(/<\?xml[^>]*\?>/, '')`: the first XML declaration removed. */
export function withoutXmlDeclaration(text: string): string {
  for (
    let at = text.indexOf('<?xml');
    at !== -1;
    at = text.indexOf('<?xml', at + 1)
  ) {
    const gt = text.indexOf('>', at + '<?xml'.length);
    if (gt === -1) return text;
    // The character before that `>` (never one of `<?xml` itself, whose
    // last is `l`) must be the `?` of `?>`.
    if (text.charAt(gt - 1) === '?')
      return text.slice(0, at) + text.slice(gt + 1);
  }
  return text;
}

/**
 * `text.replace(/<([A-Za-z][\w-]*):usageScopeResult\b([^>]*)>/, '<$1:scope$2>')`,
 * then `.replace(/<\/([A-Za-z][\w-]*):usageScopeResult>/, '</$1:scope>')`:
 * the first scope result, open and close, renamed to `scope`.
 */
export function scopeResultAsScope(text: string): string {
  let out = text;
  for (let at = out.indexOf('<'); at !== -1; at = out.indexOf('<', at + 1)) {
    const name = prefixedNameAt(out, at, '<', ':usageScopeResult');
    if (!name || !wordBoundary(out, name.end)) continue;
    const gt = out.indexOf('>', name.end);
    if (gt === -1) continue;
    out = `${out.slice(0, at)}${out.slice(at, name.prefixEnd)}:scope${out.slice(name.end, gt)}>${out.slice(gt + 1)}`;
    break;
  }
  for (let at = out.indexOf('</'); at !== -1; at = out.indexOf('</', at + 1)) {
    const name = prefixedNameAt(out, at, '</', ':usageScopeResult>');
    if (!name) continue;
    out = `${out.slice(0, at)}${out.slice(at, name.prefixEnd)}:scope>${out.slice(name.end)}`;
    break;
  }
  return out;
}

/**
 * Every value of `/href="([^"]+)"/g`, as an `exec` loop found them: each
 * `href="` (no word boundary, so `xhref="` too), its value to the next `"`; an
 * empty value is skipped and the search resumes one character later.
 */
export function hrefValues(text: string): string[] {
  const values: string[] = [];
  const marker = 'href="';
  let at = text.indexOf(marker);
  while (at !== -1) {
    const from = at + marker.length;
    const close = text.indexOf('"', from);
    if (close === -1) break;
    if (close > from) {
      values.push(text.slice(from, close));
      at = text.indexOf(marker, close + 1);
    } else at = text.indexOf(marker, at + 1);
  }
  return values;
}

/** `/\.hana\.ondemand\.com/i.test(text)`: a folded, unanchored search. */
export function namesHanaOnDemand(text: string): boolean {
  const host = '.hana.ondemand.com';
  for (let at = 0; at + host.length <= text.length; at++)
    if (foldedAt(text, at, host)) return true;
  return false;
}
