/**
 * Reading a parsed document — XML through fast-xml-parser, or JSON.
 *
 * A parsed document is data from outside the type system: what the parser
 * makes of it depends on what the server sent, so it is held as `unknown` and
 * read through these, never typed `any`. Each reader answers `undefined` (or
 * nothing) for a value that is not what it reads, so a document of another
 * shape reads as one that lacks the field.
 *
 * Internal to this package; the readings use it, the public surface does not
 * carry it.
 */

import type { X2jOptions, XMLParser } from 'fast-xml-parser';

/** A parsed element: what the parser makes of an element with children. */
export type ParsedElement = Record<string, unknown>;

/** Whether a parsed value is an element (an object, an array included). */
export function isElement(value: unknown): value is ParsedElement {
  return typeof value === 'object' && value !== null;
}

/**
 * A field of a parsed element, or `undefined` when the value is not an element
 * or has no such field.
 */
export function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

/** A field several levels down: `at(root, 'a', 'b')` is `root.a.b`, or `undefined`. */
export function at(node: unknown, ...keys: string[]): unknown {
  let value = node;
  for (const key of keys) value = field(value, key);
  return value;
}

/**
 * A value that may be one element or several, as a list: nothing (`undefined`
 * or `null`) is none, an array is itself, anything else is one.
 */
export function listOf(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * A leaf as text: a string as it is, a number or a boolean the parser coerced
 * as its text, anything else `undefined`.
 */
export function leafText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return undefined;
}

const PREDEFINED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
]);

const DECIMAL_DIGITS = '0123456789';
const HEX_DIGITS = '0123456789abcdefABCDEF';

/** Whether a code point is a `Char` of XML 1.0 (§2.2). */
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  );
}

/** Whether every character of `text` is one of `digits`, and there is one. */
function allOf(text: string, digits: string): boolean {
  if (text === '') return false;
  for (const character of text) if (!digits.includes(character)) return false;
  return true;
}

/**
 * The text a reference names — `amp`, `#38`, `#x26` (what stands between `&`
 * and `;`) — or `undefined` when it names nothing XML defines.
 */
function referenced(name: string): string | undefined {
  const predefined = PREDEFINED_ENTITIES.get(name);
  if (predefined !== undefined) return predefined;
  if (!name.startsWith('#')) return undefined;
  const hex = name.startsWith('#x');
  const digits = name.slice(hex ? 2 : 1);
  if (!allOf(digits, hex ? HEX_DIGITS : DECIMAL_DIGITS)) return undefined;
  const code = Number.parseInt(digits, hex ? 16 : 10);
  return isXmlChar(code) ? String.fromCodePoint(code) : undefined;
}

/**
 * Text as an XML parser hands it over: the five predefined entities and every
 * character reference (`&#38;`, `&#x26;`) replaced by the character it names,
 * in one pass, so `&amp;#x26;` is the text `&#x26;` and not `&`. A reference
 * XML does not define (`&nbsp;`, a code point outside `Char`) stays as it is
 * written. Plain code: one scan, no regular expression.
 */
export function decodeXmlText(text: string): string {
  if (!text.includes('&')) return text;
  let decoded = '';
  let from = 0;
  for (;;) {
    const start = text.indexOf('&', from);
    if (start < 0) break;
    const end = text.indexOf(';', start + 1);
    if (end < 0) break;
    const character = referenced(text.slice(start + 1, end));
    if (character === undefined) {
      decoded += text.slice(from, start + 1);
      from = start + 1;
      continue;
    }
    decoded += text.slice(from, start) + character;
    from = end + 1;
  }
  return decoded + text.slice(from);
}

/**
 * The parser options every reading of an ADT document shares: values are
 * text as written — no number, boolean or date is made of a tag or an
 * attribute (`007` stays `007`) — and references are decoded as an XML
 * parser decodes them (`decodeXmlText`), not by the parser's own entity
 * handling, which leaves character references as written.
 */
export const XML_TEXT_OPTIONS: Readonly<
  Pick<
    X2jOptions,
    | 'parseTagValue'
    | 'parseAttributeValue'
    | 'processEntities'
    | 'tagValueProcessor'
    | 'attributeValueProcessor'
  >
> = {
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  tagValueProcessor: (_name: string, value: string): string =>
    restoreCdata(decodeXmlText(value)),
  attributeValueProcessor: (_name: string, value: string): string =>
    decodeXmlText(value),
};

/**
 * What stands in for `&` inside a CDATA section while the document is
 * parsed: U+FFFF, which XML 1.0 does not allow in a document (§2.2 `Char`),
 * so no text of a well-formed one holds it.
 */
const CDATA_AMPERSAND = '\uffff';

/**
 * The document with every `&` inside a CDATA section replaced by
 * `CDATA_AMPERSAND`. The parser hands a CDATA section's text to
 * `tagValueProcessor` exactly as it hands element text, with nothing to tell
 * them apart; replaced, no `&` of a CDATA section is decoded, and the
 * processor puts each back (`<![CDATA[&amp;]]>` stays `&amp;`).
 */
function protectCdata(document: string): string {
  if (!document.includes('<![CDATA[')) return document;
  let protectedText = '';
  let from = 0;
  for (;;) {
    const open = document.indexOf('<![CDATA[', from);
    if (open < 0) break;
    const start = open + '<![CDATA['.length;
    const end = document.indexOf(']]>', start);
    if (end < 0) break;
    protectedText +=
      document.slice(from, start) +
      document.slice(start, end).split('&').join(CDATA_AMPERSAND);
    from = end;
  }
  return protectedText + document.slice(from);
}

/** A CDATA section's `&`, put back. */
function restoreCdata(text: string): string {
  return text.includes(CDATA_AMPERSAND)
    ? text.split(CDATA_AMPERSAND).join('&')
    : text;
}

/**
 * A document parsed by a parser built on `XML_TEXT_OPTIONS`, or `undefined`
 * when the parser throws: its CDATA sections kept as written
 * (`protectCdata`), and nothing the parser says read (`parsedOrNothing`).
 */
export function parsedText(parser: XMLParser, text: string): unknown {
  return parsedOrNothing(parser, protectCdata(text));
}

/**
 * A document parsed, or `undefined` when the parser throws — an entity it
 * refuses, nesting past its limit, anything. What the parser said is never
 * read: its message quotes the document, and a reading answers in its own
 * fixed words (or its empty shape) for a document it cannot read.
 */
export function parsedOrNothing(parser: XMLParser, text: string): unknown {
  try {
    return parser.parse(text);
  } catch {
    return undefined;
  }
}
