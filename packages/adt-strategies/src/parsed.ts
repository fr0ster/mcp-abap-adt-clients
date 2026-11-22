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
  return decodeReferences(text, referenced);
}

/** Whether a character may stand in a reference's name: `#`, a letter, a digit. */
function isReferenceCharacter(character: string): boolean {
  return (
    character === '#' ||
    (character >= '0' && character <= '9') ||
    (character >= 'a' && character <= 'z') ||
    (character >= 'A' && character <= 'Z')
  );
}

/**
 * Every `&name;` of a text replaced by what `lookup` says it names, one pass
 * from left to right. From each `&` the name is read only while its
 * characters can belong to one, so no character is looked at twice: a text
 * of a million `& ` and one `;` is read once, not once per `&`. A reference
 * `lookup` does not know stays as written.
 */
export function decodeReferences(
  text: string,
  lookup: (name: string) => string | undefined,
): string {
  if (!text.includes('&')) return text;
  let decoded = '';
  let from = 0;
  let at = text.indexOf('&');
  while (at >= 0) {
    let end = at + 1;
    while (end < text.length && isReferenceCharacter(text.charAt(end))) {
      end += 1;
    }
    const character =
      text.charAt(end) === ';' ? lookup(text.slice(at + 1, end)) : undefined;
    if (character !== undefined) {
      decoded += text.slice(from, at) + character;
      from = end + 1;
    }
    at = text.indexOf('&', character === undefined ? at + 1 : end + 1);
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
    | 'cdataPropName'
  >
> = {
  // A CDATA section is kept apart, as written: the parser calls neither
  // processor on it, so no reference in it is decoded (`ownText` reads it).
  cdataPropName: '#cdata',
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  tagValueProcessor: (_name: string, value: string): string =>
    decodeXmlText(value),
  attributeValueProcessor: (_name: string, value: string): string =>
    decodeXmlText(value),
};

/**
 * A document parsed by a parser built on `XML_TEXT_OPTIONS`, or `undefined`
 * when the parser throws (`parsedOrNothing`).
 */
export function parsedText(parser: XMLParser, text: string): unknown {
  return parsedOrNothing(parser, text);
}

/**
 * An element's own text, as `XML_TEXT_OPTIONS` parses it: a leaf as text
 * (`leafText`), or an element's `#text` followed by its CDATA sections
 * (`#cdata`, kept as written). Where text and CDATA alternate inside one
 * element their order is not kept: the parser stores them apart. `undefined`
 * for an element with neither.
 */
export function ownText(value: unknown): string | undefined {
  const leaf = leafText(value);
  if (leaf !== undefined) return leaf;
  if (!isElement(value) || Array.isArray(value)) return undefined;
  const text = leafText(value['#text']);
  const sections = listOf(value['#cdata']).flatMap((section) => {
    const content = leafText(section);
    return content === undefined ? [] : [content];
  });
  if (text === undefined && sections.length === 0) return undefined;
  return (text ?? '') + sections.join('');
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
