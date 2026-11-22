/**
 * What the transport readings share: the document parsed with its values as
 * written, its `tm:root`, and reading a `tm:` attribute or child.
 *
 * Every name is read prefixed (`tm:number`) and, failing that, bare
 * (`number`): a release that writes the attributes unqualified reads the same.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  field,
  isElement,
  leafText,
  listOf,
  type ParsedElement,
  parsedText,
  XML_TEXT_OPTIONS,
} from '../../parsed';

const parser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * The document's `tm:root` element — `undefined` for anything that is no
 * well-formed XML text with that root. A root written `<tm:root/>` reads as
 * an element with nothing in it, never as the empty string the parser makes
 * of it.
 */
export function transportRoot(document: unknown): ParsedElement | undefined {
  if (typeof document !== 'string' || document.trim() === '') return undefined;
  if (XMLValidator.validate(document) !== true) return undefined;
  const parsed: unknown = parsedText(parser, document);
  const root = field(parsed, 'tm:root') ?? field(parsed, 'root');
  if (isElement(root) && !Array.isArray(root)) return root;
  // A self-closed root without attributes is parsed as ''.
  return root === '' ? {} : undefined;
}

/** A `tm:` attribute of an element, as written; `undefined` when absent. */
export function tmAttribute(node: unknown, name: string): string | undefined {
  return (
    leafText(field(node, `@_tm:${name}`)) ?? leafText(field(node, `@_${name}`))
  );
}

/** Every `tm:` child element of that name, as a list. */
export function tmChildren(node: unknown, name: string): unknown[] {
  const prefixed = field(node, `tm:${name}`);
  return listOf(prefixed === undefined ? field(node, name) : prefixed);
}

/** Whether an element carries an attribute of its own (`xmlns` aside) or a child element. */
export function hasContent(node: ParsedElement): boolean {
  for (const key of Object.keys(node)) {
    if (key === '#text') continue;
    if (key === '@_xmlns' || key.startsWith('@_xmlns:')) continue;
    return true;
  }
  return false;
}

/** The namespace of `tm:` (recorded, every system). */
export const TM_NAMESPACE = 'http://www.sap.com/cts/adt/tm';

/** Prefixes in scope on an element (`''` the default namespace) and their URIs. */
export type TmScope = ReadonlyMap<string, string>;

/** An element and the namespaces in scope on it. */
export interface ITmElement {
  element: unknown;
  scope: TmScope;
}

/** The namespaces in scope on an element: its parent's, and its own `xmlns` declarations. */
function scopeOn(element: unknown, parent: TmScope): TmScope {
  if (!isElement(element) || Array.isArray(element)) return parent;
  let scope: Map<string, string> | undefined;
  for (const [key, value] of Object.entries(element)) {
    if (key !== '@_xmlns' && !key.startsWith('@_xmlns:')) continue;
    const uri = leafText(value);
    if (uri === undefined) continue;
    scope ??= new Map(parent);
    scope.set(key === '@_xmlns' ? '' : key.slice('@_xmlns:'.length), uri);
  }
  return scope ?? parent;
}

/** The document's root as an element with its scope. */
export function tmRootElement(root: ParsedElement): ITmElement {
  return { element: root, scope: scopeOn(root, new Map()) };
}

/**
 * Whether an element name is `tm:<local>` by namespace: a prefix bound to
 * the tm namespace, or no prefix where the default namespace is tm or none
 * (the bare names `tmChildren` reads too).
 */
function namesTm(qname: string, scope: TmScope, local: string): boolean {
  const colon = qname.indexOf(':');
  if (colon < 0) {
    const uri = scope.get('');
    return qname === local && (uri === undefined || uri === TM_NAMESPACE);
  }
  return (
    qname.slice(colon + 1) === local &&
    scope.get(qname.slice(0, colon)) === TM_NAMESPACE
  );
}

/**
 * Every child element `tm:<local>` of a parent, by namespace URI and local
 * name whatever its prefix — so `<tm:task>` beside `<task>` in the tm default
 * namespace, or beside `<t2:task>` with `t2` bound to tm, is two tasks.
 */
export function tmElements(parent: ITmElement, local: string): ITmElement[] {
  const { element } = parent;
  if (!isElement(element) || Array.isArray(element)) return [];
  const found: ITmElement[] = [];
  for (const [key, value] of Object.entries(element)) {
    if (key.startsWith('@_') || key === '#text') continue;
    for (const item of listOf(value)) {
      const scope = scopeOn(item, parent.scope);
      if (namesTm(key, scope, local)) found.push({ element: item, scope });
    }
  }
  return found;
}

/**
 * A `tm:<local>` attribute of an element by namespace (a prefix bound to tm,
 * or the bare name), decoded and trimmed: literal padding and padding written
 * as a reference (`&#32;`) read the same. `undefined` when absent.
 */
export function tmTrimmedAttribute(
  tm: ITmElement,
  local: string,
): string | undefined {
  const { element, scope } = tm;
  if (!isElement(element) || Array.isArray(element)) return undefined;
  for (const [key, value] of Object.entries(element)) {
    if (!key.startsWith('@_') || key.startsWith('@_xmlns')) continue;
    const name = key.slice(2);
    const colon = name.indexOf(':');
    const matches =
      colon < 0
        ? name === local
        : name.slice(colon + 1) === local &&
          scope.get(name.slice(0, colon)) === TM_NAMESPACE;
    if (matches) return leafText(value)?.trim();
  }
  return undefined;
}
