/**
 * Reading a page of the ABAP keyword documentation
 * (`/sap/bc/adt/docu/abap/langu`, `application/vnd.sap.adt.docu.v1+html`):
 * its title, its text and every link it carries.
 *
 * Measured on ABAP cloud and on premise (2026-11-28): a page is XHTML 1.1 by
 * its doctype, 124–184 KB, most of it `data:` images and a `style` element;
 * a topic link is `adtcom:/sap/bc/adt/docu/abap/langu?…&object=<topic>` with
 * `sap-language`, `version` and `style`, its `&` unescaped. Whether every page
 * is well-formed XHTML is unverified, so the page is read by a tokenizer of
 * plain code — no regular expression, no DOM, no XML parser — that reads up to
 * its last complete token.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { decodeReferences } from '../parsed';
import { rawOf } from '../result';

/** A link to another topic of the documentation, as the page carries it. */
export interface IDocuTopicLink {
  readonly kind: 'topic';
  /** The `href` as written, its entities decoded. */
  readonly href: string;
  /** The `object` parameter: the topic's name. */
  readonly object: string;
  /** The `version` parameter; `null` when absent, `''` when present and empty. */
  readonly version: string | null;
  /** `sap-language`, else `language`; `null` when neither is present. */
  readonly language: string | null;
  /** The link's text. */
  readonly label: string;
}

/** Any other link of the page: an anchor, a relative or an external URL. */
export interface IDocuOtherLink {
  readonly kind: 'other';
  readonly href: string;
  readonly label: string;
}

/** One `a` element with an `href`. */
export type DocuLink = IDocuTopicLink | IDocuOtherLink;

/** A documentation page read. */
export interface IDocuPage {
  /** The first `title` element's text; `''` when the page has none. */
  readonly title: string;
  /** The text of the `body` (the whole document without one). */
  readonly text: string;
  /** Every `a` element with an `href`, in document order, repeats included. */
  readonly links: readonly DocuLink[];
  /**
   * The page's version choices: every `option` whose `value` is a topic link
   * (its `href` is the value), in document order. Measured on both kinds
   * (2026-11-28): a topic page offers "Standard ABAP" and "ABAP Cloud", each
   * naming the page's own topic, in upper case.
   */
  readonly versions: readonly IDocuTopicLink[];
}

const TOPIC_PATH = '/sap/bc/adt/docu/abap/langu';
const ADT_SCHEME = 'adtcom:';

/** The elements whose content is no text of the page. */
const SKIPPED = new Set(['style', 'script', 'svg']);

/** The elements whose content is raw text, up to their own end tag. */
const RAW_TEXT = new Set(['style', 'script']);

/**
 * Where the text after `</name …>` starts, searching from `from`, the name
 * compared case-insensitively; `-1` when the page ends first.
 */
function indexOfEndTag(html: string, name: string, from: number): number {
  const lower = html.toLowerCase();
  let at = lower.indexOf(`</${name}`, from);
  while (at >= 0) {
    const after = lower.charAt(at + 2 + name.length);
    if (after === '>' || after === '/' || isSpace(after)) {
      const close = html.indexOf('>', at);
      return close < 0 ? -1 : close + 1;
    }
    at = lower.indexOf(`</${name}`, at + 1);
  }
  return -1;
}

const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['copy', '©'],
  ['reg', '®'],
  ['trade', '™'],
  ['rarr', '→'],
  ['larr', '←'],
  ['uarr', '↑'],
  ['darr', '↓'],
  ['ndash', '–'],
  ['mdash', '—'],
  ['hellip', '…'],
  ['laquo', '«'],
  ['raquo', '»'],
  ['lsquo', '‘'],
  ['rsquo', '’'],
  ['ldquo', '“'],
  ['rdquo', '”'],
  ['middot', '·'],
  ['bull', '•'],
]);

const DECIMAL = '0123456789';
const HEX = '0123456789abcdefABCDEF';

function allOf(text: string, digits: string): boolean {
  if (text === '') return false;
  for (const character of text) if (!digits.includes(character)) return false;
  return true;
}

function entity(name: string): string | undefined {
  const named = NAMED_ENTITIES.get(name);
  if (named !== undefined) return named;
  if (!name.startsWith('#')) return undefined;
  const hex = name.startsWith('#x') || name.startsWith('#X');
  const digits = name.slice(hex ? 2 : 1);
  if (!allOf(digits, hex ? HEX : DECIMAL)) return undefined;
  const code = Number.parseInt(digits, hex ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : undefined;
}

/** Text with its entities decoded; an entity not known stays as written. */
function decoded(text: string): string {
  return decodeReferences(text, entity);
}

const isSpace = (character: string): boolean => character.trim() === '';

/** Whitespace runs as one space, trimmed (U+00A0 is whitespace too). */
export function collapsed(text: string): string {
  let out = '';
  let pending = false;
  for (const character of text) {
    if (isSpace(character)) {
      pending = out !== '';
      continue;
    }
    if (pending) out += ' ';
    out += character;
    pending = false;
  }
  return out;
}

const isNameCharacter = (character: string): boolean =>
  character !== '' &&
  !isSpace(character) &&
  character !== '>' &&
  character !== '/' &&
  character !== '=';

interface ITag {
  /** Lowercased element name. */
  readonly name: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
  readonly attributes: ReadonlyMap<string, string>;
  /** Where the text after the tag starts. */
  readonly end: number;
}

/**
 * The tag that starts at `at` (a `<`), or `undefined` when the page ends
 * before its `>`. Attribute values may hold `>` inside their quotes.
 */
function readTag(html: string, at: number): ITag | undefined {
  let i = at + 1;
  const closing = html.charAt(i) === '/';
  if (closing) i += 1;
  const nameStart = i;
  while (i < html.length && isNameCharacter(html.charAt(i))) i += 1;
  const name = html.slice(nameStart, i).toLowerCase();
  const attributes = new Map<string, string>();
  let selfClosing = false;
  while (i < html.length) {
    const character = html.charAt(i);
    if (character === '>') {
      return { name, closing, selfClosing, attributes, end: i + 1 };
    }
    if (character === '/') {
      selfClosing = true;
      i += 1;
      continue;
    }
    if (isSpace(character)) {
      i += 1;
      continue;
    }
    selfClosing = false;
    const keyStart = i;
    while (i < html.length && isNameCharacter(html.charAt(i))) i += 1;
    if (i === keyStart) {
      // A character no attribute name holds (a stray `=`): step over it.
      i += 1;
      continue;
    }
    const key = html.slice(keyStart, i).toLowerCase();
    while (i < html.length && isSpace(html.charAt(i))) i += 1;
    if (html.charAt(i) !== '=') {
      if (!attributes.has(key)) attributes.set(key, '');
      continue;
    }
    i += 1;
    while (i < html.length && isSpace(html.charAt(i))) i += 1;
    const quote = html.charAt(i);
    let value: string;
    if (quote === '"' || quote === "'") {
      const close = html.indexOf(quote, i + 1);
      if (close < 0) return undefined;
      value = html.slice(i + 1, close);
      i = close + 1;
    } else {
      const valueStart = i;
      while (
        i < html.length &&
        !isSpace(html.charAt(i)) &&
        html.charAt(i) !== '>'
      ) {
        i += 1;
      }
      value = html.slice(valueStart, i);
    }
    if (!attributes.has(key)) attributes.set(key, decoded(value));
  }
  return undefined;
}

/** A query string's parameters, the first occurrence of each, percent-decoded. */
function queryParameters(query: string): ReadonlyMap<string, string> {
  const parameters = new Map<string, string>();
  const percentDecoded = (part: string): string => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  };
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const key = percentDecoded(eq < 0 ? pair : pair.slice(0, eq));
    if (parameters.has(key)) continue;
    parameters.set(key, eq < 0 ? '' : percentDecoded(pair.slice(eq + 1)));
  }
  return parameters;
}

/** A link of the page, told a topic link or another. */
export function docuLink(href: string, label: string): DocuLink {
  const rest = href.startsWith(ADT_SCHEME)
    ? href.slice(ADT_SCHEME.length)
    : href;
  const question = rest.indexOf('?');
  if (question >= 0 && rest.slice(0, question) === TOPIC_PATH) {
    const parameters = queryParameters(rest.slice(question + 1));
    const object = parameters.get('object');
    if (object !== undefined) {
      return {
        kind: 'topic',
        href,
        object,
        version: parameters.get('version') ?? null,
        language:
          parameters.get('sap-language') ?? parameters.get('language') ?? null,
        label,
      };
    }
  }
  return { kind: 'other', href, label };
}

interface IOpenLink {
  readonly href: string;
  label: string;
}

/** The page read, or `undefined` when the text has no `html` element. */
export function readDocuPage(html: string): IDocuPage | undefined {
  let sawHtml = false;
  let sawBody = false;
  let inBody = false;
  let skipped = 0;
  let titleState: 'before' | 'inside' | 'done' = 'before';
  let title = '';
  let allText = '';
  let bodyText = '';
  const links: { readonly href: string; readonly entry: IOpenLink }[] = [];
  const options: IOpenLink[] = [];
  let option: IOpenLink | undefined;
  // One entry per open `a`: its link, or `undefined` for one without `href`.
  const open: (IOpenLink | undefined)[] = [];

  const addText = (raw: string): void => {
    if (raw === '' || skipped > 0) return;
    const text = decoded(raw);
    if (titleState === 'inside') title += text;
    allText += text;
    if (inBody) bodyText += text;
    for (const link of open) if (link !== undefined) link.label += text;
    if (option !== undefined) option.label += text;
  };

  let from = 0;
  while (from < html.length) {
    const lt = html.indexOf('<', from);
    if (lt < 0) {
      addText(html.slice(from));
      break;
    }
    addText(html.slice(from, lt));
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      if (close < 0) break;
      from = close + 3;
      continue;
    }
    const next = html.charAt(lt + 1);
    if (next === '!' || next === '?') {
      const close = html.indexOf('>', lt + 2);
      if (close < 0) break;
      from = close + 1;
      continue;
    }
    const tag = readTag(html, lt);
    if (tag === undefined) break;
    from = tag.end;
    if (tag.name === '') {
      // `<` followed by no name: text, as a browser reads it.
      addText(html.slice(lt, tag.end));
      continue;
    }
    if (tag.name === 'html' && !tag.closing) sawHtml = true;
    if (tag.name === 'body') {
      if (!tag.closing) {
        sawBody = true;
        inBody = true;
      } else {
        inBody = false;
      }
    }
    if (RAW_TEXT.has(tag.name) && !tag.closing && !tag.selfClosing) {
      // A style's or a script's content is raw text up to its end tag: a `<`
      // inside it starts no tag.
      const end = indexOfEndTag(html, tag.name, from);
      if (end < 0) break;
      from = end;
      continue;
    }
    if (SKIPPED.has(tag.name)) {
      if (tag.closing) {
        if (skipped > 0) skipped -= 1;
      } else if (!tag.selfClosing) {
        skipped += 1;
      }
      continue;
    }
    if (skipped > 0) continue;
    if (tag.name === 'title') {
      if (!tag.closing && titleState === 'before') titleState = 'inside';
      else if (tag.closing && titleState === 'inside') titleState = 'done';
      continue;
    }
    if (tag.name === 'option') {
      option = undefined;
      if (tag.closing || tag.selfClosing) continue;
      const value = tag.attributes.get('value');
      if (value === undefined || value === '') continue;
      option = { href: value, label: '' };
      options.push(option);
      continue;
    }
    if (tag.name === 'select') option = undefined;
    if (tag.name === 'a') {
      if (tag.closing) {
        open.pop();
        continue;
      }
      if (tag.selfClosing) continue;
      const href = tag.attributes.get('href');
      if (href === undefined) {
        open.push(undefined);
        continue;
      }
      const entry: IOpenLink = { href, label: '' };
      links.push({ href, entry });
      open.push(entry);
    }
  }

  if (!sawHtml) return undefined;
  return {
    title: collapsed(title),
    text: collapsed(sawBody ? bodyText : allText),
    links: links.map(({ href, entry }) =>
      docuLink(href, collapsed(entry.label)),
    ),
    versions: options.flatMap((choice) => {
      const link = docuLink(choice.href, collapsed(choice.label));
      return link.kind === 'topic' ? [link] : [];
    }),
  };
}

/** `docuPage`: the page an answer carries, or `undefined` when it is no page. */
export const docuPage: IResultStrategy<IDocuPage | undefined> = (answer) =>
  readDocuPage(rawOf(answer));
