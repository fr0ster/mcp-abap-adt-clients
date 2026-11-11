/**
 * Locate and splice elements of an ADT document, in plain string code.
 *
 * The shipped document patches (`src/core/<type>/patch.ts`) change a few
 * values in a document SAP sent and must send everything else back as SAP
 * stored it — attribute order, quoting, entities, white space and the
 * attributes this library knows nothing about. A parse-and-rebuild cannot
 * promise that, and a pattern matched over the whole text finds the first
 * element of a name anywhere, which is how a package reference's description
 * was once written instead of the object's own. So this walks the document
 * once, character by character, and reports where each element and attribute
 * sits; an edit is a splice of those ranges and touches nothing else.
 *
 * Well-formedness is fast-xml-parser's `XMLValidator`'s call; the walk relies
 * on it, refuses what it cannot place, and refuses what the validator lets
 * through: outside the root, a second top-level element, text, CDATA or a
 * DOCTYPE after the root; inside it, a reference that is not one of the five
 * predefined entities or a character reference to an XML character (the
 * validator reads no reference in an attribute value and takes any `&name;`
 * in text), `<` in an attribute value and `]]>` in text. A conforming parser
 * refuses each of them, so a patch must not answer them as a document.
 */
import { XMLValidator } from 'fast-xml-parser';

/** `[start, end)` in the document's text. */
export interface TextRange {
  readonly start: number;
  readonly end: number;
}

export interface AttributeLocation {
  readonly name: string;
  /** The value between its quotes. */
  readonly value: TextRange;
  readonly quote: '"' | "'";
}

export interface ElementLocation {
  /** The qualified name as written (`doma:length`). */
  readonly name: string;
  /** From `<` through the `>` that closes the start tag. */
  readonly startTag: TextRange;
  /** Just after the name inside the start tag. */
  readonly nameEnd: number;
  /** The start tag's own closer: `>` or `/>`. */
  readonly tagClose: TextRange;
  readonly attributes: readonly AttributeLocation[];
  /** Between the start and the end tag; absent for `<x/>`. */
  readonly content: TextRange | undefined;
  /** Just after the end tag (after the start tag for `<x/>`). */
  readonly end: number;
  readonly children: readonly ElementLocation[];
}

/** One edit: `text` replaces `[start, end)`. */
export interface Splice extends TextRange {
  readonly text: string;
}

interface OpenElement {
  name: string;
  startTag: TextRange;
  nameEnd: number;
  tagClose: TextRange;
  attributes: AttributeLocation[];
  children: ElementLocation[];
}

function isSpace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\r' || char === '\n';
}

/** Where a name that starts at `from` ends. */
function nameEndAt(text: string, from: number): number {
  let at = from;
  while (at < text.length) {
    const char = text.charAt(at);
    if (isSpace(char) || char === '/' || char === '>' || char === '=') break;
    at += 1;
  }
  return at;
}

/** Whether `[from, to)` holds white space only. */
function isBlank(text: string, from: number, to: number): boolean {
  for (let at = from; at < to; at += 1) {
    if (!isSpace(text.charAt(at))) return false;
  }
  return true;
}

const PREDEFINED_ENTITIES: readonly string[] = [
  'amp',
  'lt',
  'gt',
  'quot',
  'apos',
];

/** Whether `code` is a `Char` of XML 1.0 (§2.2). */
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

/** The digit's value in `radix`, or -1 when it is not one. */
function digitValue(code: number, radix: 10 | 16): number {
  if (code >= 0x30 && code <= 0x39) return code - 0x30;
  if (radix === 10) return -1;
  if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10;
  if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10;
  return -1;
}

/**
 * Whether `body` (between `&#` and `;`) references an XML character; no
 * digit reads as 0 and a value past U+10FFFF is no character either.
 */
function isCharacterReference(body: string): boolean {
  const radix = body.startsWith('x') ? 16 : 10;
  const digits = radix === 16 ? body.slice(1) : body;
  let code = 0;
  for (let at = 0; at < digits.length; at += 1) {
    const digit = digitValue(digits.charCodeAt(at), radix);
    if (digit < 0) return false;
    code = code * radix + digit;
  }
  return isXmlChar(code);
}

/**
 * Whether every `&` in `[from, to)` starts a reference to a predefined entity
 * or to an XML character (XML 1.0 §4.1). A document here declares no entity
 * of its own: the walk refuses an internal DTD subset.
 */
function referencesWellFormed(text: string, from: number, to: number): boolean {
  let reference = -1;
  for (let at = from; at < to; at += 1) {
    const char = text.charAt(at);
    if (reference < 0) {
      if (char === '&') reference = at;
    } else if (char === ';') {
      const body = text.slice(reference + 1, at);
      const known = body.startsWith('#')
        ? isCharacterReference(body.slice(1))
        : PREDEFINED_ENTITIES.includes(body);
      if (!known) return false;
      reference = -1;
    }
  }
  return reference < 0;
}

/** Whether `[from, to)` is well-formed character data (XML 1.0 §2.4). */
function isCharData(text: string, from: number, to: number): boolean {
  return (
    !text.slice(from, to).includes(']]>') &&
    referencesWellFormed(text, from, to)
  );
}

/** Whether `[from, to)` is a well-formed attribute value (XML 1.0 §2.3). */
function isAttributeValue(text: string, from: number, to: number): boolean {
  return (
    !text.slice(from, to).includes('<') && referencesWellFormed(text, from, to)
  );
}

function skipSpace(text: string, from: number): number {
  let at = from;
  while (at < text.length && isSpace(text.charAt(at))) at += 1;
  return at;
}

/** The index just after `close`, searched from `from`; -1 when absent. */
function after(text: string, close: string, from: number): number {
  const at = text.indexOf(close, from);
  return at < 0 ? -1 : at + close.length;
}

/**
 * A start tag from its `<` to its closer, attributes read in order; or
 * `undefined` when it cannot be placed.
 */
function readStartTag(text: string, start: number): OpenElement | undefined {
  const nameEnd = nameEndAt(text, start + 1);
  if (nameEnd === start + 1) return undefined;
  const attributes: AttributeLocation[] = [];
  let at = nameEnd;
  for (;;) {
    at = skipSpace(text, at);
    if (at >= text.length) return undefined;
    if (text.startsWith('/>', at) || text.charAt(at) === '>') {
      const close = text.charAt(at) === '>' ? at + 1 : at + 2;
      return {
        name: text.slice(start + 1, nameEnd),
        startTag: { start, end: close },
        nameEnd,
        tagClose: { start: at, end: close },
        attributes,
        children: [],
      };
    }
    const attributeEnd = nameEndAt(text, at);
    if (attributeEnd === at) return undefined;
    const name = text.slice(at, attributeEnd);
    at = skipSpace(text, attributeEnd);
    if (text.charAt(at) !== '=') return undefined;
    at = skipSpace(text, at + 1);
    const quote = text.charAt(at);
    if (quote !== '"' && quote !== "'") return undefined;
    const valueEnd = text.indexOf(quote, at + 1);
    if (valueEnd < 0) return undefined;
    if (!isAttributeValue(text, at + 1, valueEnd)) return undefined;
    attributes.push({ name, value: { start: at + 1, end: valueEnd }, quote });
    at = valueEnd + 1;
  }
}

/**
 * The root element with every element under it, or `undefined` when the text
 * is not a well-formed document (empty, blank, not XML, cut short).
 */
export function scanDocument(text: string): ElementLocation | undefined {
  if (text.trim() === '') return undefined;
  if (XMLValidator.validate(text) !== true) return undefined;

  const stack: OpenElement[] = [];
  let root: ElementLocation | undefined;
  let at = 0;
  while (at < text.length) {
    const found = text.indexOf('<', at);
    const open = found < 0 ? text.length : found;
    // Outside the root only white space, comments and processing
    // instructions may stand (and a DOCTYPE before it); the validator lets a
    // second top-level element through, so the walk refuses it here.
    const outside = stack.length === 0;
    if (outside && !isBlank(text, at, open)) return undefined;
    if (!outside && !isCharData(text, at, open)) return undefined;
    if (found < 0) break;
    let next: number;
    if (text.startsWith('<?', open)) {
      next = after(text, '?>', open + 2);
    } else if (text.startsWith('<!--', open)) {
      next = after(text, '-->', open + 4);
    } else if (outside && root !== undefined) {
      return undefined;
    } else if (text.startsWith('<![CDATA[', open)) {
      if (outside) return undefined;
      next = after(text, ']]>', open + 9);
    } else if (text.startsWith('<!', open)) {
      next = after(text, '>', open + 2);
    } else if (text.startsWith('</', open)) {
      const nameEnd = nameEndAt(text, open + 2);
      const close = after(text, '>', nameEnd);
      const element = stack.pop();
      if (element === undefined || close < 0) return undefined;
      if (text.slice(open + 2, nameEnd) !== element.name) return undefined;
      const done: ElementLocation = {
        ...element,
        content: { start: element.startTag.end, end: open },
        end: close,
      };
      const parent = stack[stack.length - 1];
      if (parent === undefined) root = done;
      else parent.children.push(done);
      next = close;
    } else {
      const element = readStartTag(text, open);
      if (element === undefined) return undefined;
      if (text.charAt(element.tagClose.start) === '/') {
        const done: ElementLocation = {
          ...element,
          content: undefined,
          end: element.startTag.end,
        };
        const parent = stack[stack.length - 1];
        if (parent === undefined) root = done;
        else parent.children.push(done);
      } else {
        stack.push(element);
      }
      next = element.startTag.end;
    }
    if (next < 0) return undefined;
    at = next;
  }
  return stack.length === 0 ? root : undefined;
}

/** The element at `path` below `element`, each step a direct child. */
export function childAt(
  element: ElementLocation,
  path: readonly string[],
): ElementLocation | undefined {
  let current: ElementLocation | undefined = element;
  for (const step of path) {
    current = current?.children.find((child) => child.name === step);
    if (current === undefined) return undefined;
  }
  return current;
}

/**
 * The text with each splice applied. Splices do not overlap; ones at the same
 * point are inserted in the order given.
 */
export function applySplices(text: string, splices: readonly Splice[]): string {
  const ordered = splices
    .map((splice, index) => ({ splice, index }))
    .sort((a, b) => b.splice.start - a.splice.start || b.index - a.index);
  let out = text;
  for (const { splice } of ordered) {
    out = out.slice(0, splice.start) + splice.text + out.slice(splice.end);
  }
  return out;
}

function replaceAll(value: string, from: string, to: string): string {
  return value.split(from).join(to);
}

/**
 * Element text: `&`, `<` and `>` escaped, and a carriage return written as
 * `&#13;` — a parser turns a literal CR or CR LF into LF (XML 1.0 §2.11).
 */
export function escapeText(value: string): string {
  return replaceAll(
    replaceAll(
      replaceAll(replaceAll(value, '&', '&amp;'), '<', '&lt;'),
      '>',
      '&gt;',
    ),
    '\r',
    '&#13;',
  );
}

/**
 * An attribute value: as text, plus the quote it is delimited with, and LF
 * and tab written as `&#10;` and `&#9;` — a parser reads a literal one in an
 * attribute value as a space (XML 1.0 §3.3.3).
 */
export function escapeAttribute(value: string, quote: '"' | "'"): string {
  return replaceAll(
    replaceAll(
      replaceAll(escapeText(value), quote, quote === '"' ? '&quot;' : '&apos;'),
      '\n',
      '&#10;',
    ),
    '\t',
    '&#9;',
  );
}
