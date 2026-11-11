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
 * on it and refuses only what it cannot place.
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
    const open = text.indexOf('<', at);
    if (open < 0) break;
    let next: number;
    if (text.startsWith('<?', open)) {
      next = after(text, '?>', open + 2);
    } else if (text.startsWith('<!--', open)) {
      next = after(text, '-->', open + 4);
    } else if (text.startsWith('<![CDATA[', open)) {
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

/** Element text: `&`, `<` and `>` escaped. */
export function escapeText(value: string): string {
  return replaceAll(
    replaceAll(replaceAll(value, '&', '&amp;'), '<', '&lt;'),
    '>',
    '&gt;',
  );
}

/** An attribute value: as text, plus the quote it is delimited with. */
export function escapeAttribute(value: string, quote: '"' | "'"): string {
  return replaceAll(
    escapeText(value),
    quote,
    quote === '"' ? '&quot;' : '&apos;',
  );
}
