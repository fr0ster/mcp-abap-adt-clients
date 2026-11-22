/**
 * The inactive-objects list, read once for every reading of it:
 * `utilInactiveObjects` (the result) and `stillInactiveAmong` /
 * `readActivationRefusal` (the activation verdict). Two readers of one
 * document disagreed — on a namespace prefix, on a character reference in a
 * URI — and both answered a list they could not read as empty, which a
 * warning-only activation then counted as a success. This one reads by
 * namespace URI, not prefix, decodes references as `XML_TEXT_OPTIONS` does,
 * and answers `null` for any document it does not recognise.
 *
 * Internal to this package.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  isElement,
  leafText,
  listOf,
  type ParsedElement,
  parsedText,
  XML_TEXT_OPTIONS,
} from './parsed';

/** The namespace of `ioc:inactiveObjects` (recorded on S/4HANA 2025 and the cloud). */
const IOC = 'http://www.sap.com/abapxml/inactiveCtsObjects';
/** The namespace of `adtcore:` (recorded, every system). */
const ADTCORE = 'http://www.sap.com/adt/core';

const parser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/** One object the list names, its attributes as written; empty ones absent. */
export interface IListedInactiveObject {
  name: string;
  type?: string;
  uri?: string;
  parentUri?: string;
}

type Scope = ReadonlyMap<string, string>;

/** The namespaces in scope on an element: its parent's, and its own `xmlns` declarations. */
function scopeOf(element: ParsedElement, parent: Scope): Scope {
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

/** A qualified name's namespace URI and local name; `undefined` for an unbound prefix. */
function resolve(
  qname: string,
  scope: Scope,
): { uri: string | undefined; local: string } | undefined {
  const colon = qname.indexOf(':');
  if (colon < 0) return { uri: scope.get(''), local: qname };
  const uri = scope.get(qname.slice(0, colon));
  return uri === undefined ? undefined : { uri, local: qname.slice(colon + 1) };
}

/** An `adtcore:` attribute, by namespace URI; an empty one is absent. */
function adtcoreAttribute(
  element: ParsedElement,
  scope: Scope,
  local: string,
): string | undefined {
  for (const [key, value] of Object.entries(element)) {
    if (!key.startsWith('@_') || key.startsWith('@_xmlns')) continue;
    const name = key.slice(2);
    if (!name.includes(':')) continue; // an unprefixed attribute is in no namespace
    const resolved = resolve(name, scope);
    if (resolved?.uri !== ADTCORE || resolved.local !== local) continue;
    const text = leafText(value);
    return text === undefined || text === '' ? undefined : text;
  }
  return undefined;
}

/** An element's child elements, each with its namespace and local name. */
interface IChild {
  uri: string | undefined;
  local: string;
  element: ParsedElement;
  scope: Scope;
}

/**
 * The child elements of an element, or `null` when one cannot be read: an
 * unbound prefix, or text where an element was expected. A self-closed
 * element without attributes is parsed as `''`, read as an empty element.
 */
function childrenOf(element: ParsedElement, scope: Scope): IChild[] | null {
  const children: IChild[] = [];
  for (const [key, value] of Object.entries(element)) {
    if (key.startsWith('@_')) continue;
    // Text where the form has only elements: not a list this reads.
    if (key === '#text') {
      if (listOf(value).some((text) => leafText(text)?.trim() !== '')) {
        return null;
      }
      continue;
    }
    for (const item of listOf(value)) {
      const child: ParsedElement | undefined =
        item === ''
          ? {}
          : isElement(item) && !Array.isArray(item)
            ? item
            : undefined;
      if (child === undefined) return null;
      const childScope = scopeOf(child, scope);
      const resolved = resolve(key, childScope);
      if (resolved === undefined) return null;
      children.push({ ...resolved, element: child, scope: childScope });
    }
  }
  return children;
}

/**
 * One reference, read whole, or `null`: a reference without `adtcore:name`
 * cannot be matched against what an activation named, so the list holding
 * it is refused rather than read without it (an object dropped would read as
 * activated).
 */
function listed(
  element: ParsedElement,
  scope: Scope,
): IListedInactiveObject | null {
  const name = adtcoreAttribute(element, scope, 'name');
  if (name === undefined) return null;
  const type = adtcoreAttribute(element, scope, 'type');
  const uri = adtcoreAttribute(element, scope, 'uri');
  const parentUri = adtcoreAttribute(element, scope, 'parentUri');
  return {
    name,
    ...(type === undefined ? {} : { type }),
    ...(uri === undefined ? {} : { uri }),
    ...(parentUri === undefined ? {} : { parentUri }),
  };
}

const is = (child: IChild, uri: string, local: string): boolean =>
  child.uri === uri && child.local === local;

/** `ioc:inactiveObjects`: every `ioc:ref` of every `ioc:object` of every `ioc:entry`. */
function iocList(root: IChild): IListedInactiveObject[] | null {
  const entries = childrenOf(root.element, root.scope);
  if (entries === null) return null;
  const found: IListedInactiveObject[] = [];
  for (const entry of entries) {
    if (!is(entry, IOC, 'entry')) return null;
    const parts = childrenOf(entry.element, entry.scope);
    if (parts === null) return null;
    for (const part of parts) {
      // A transport's `ioc:ref` names the request, not an object: not read.
      if (is(part, IOC, 'transport')) continue;
      if (!is(part, IOC, 'object')) return null;
      const refs = childrenOf(part.element, part.scope);
      if (refs === null) return null;
      for (const ref of refs) {
        if (!is(ref, IOC, 'ref')) return null;
        const object = listed(ref.element, ref.scope);
        if (object === null) return null;
        found.push(object);
      }
    }
  }
  return found;
}

/** `adtcore:objectReferences`, SAP_BASIS 7.40's flat list (recorded). */
function flatList(root: IChild): IListedInactiveObject[] | null {
  const references = childrenOf(root.element, root.scope);
  if (references === null) return null;
  const found: IListedInactiveObject[] = [];
  for (const reference of references) {
    if (!is(reference, ADTCORE, 'objectReference')) return null;
    const object = listed(reference.element, reference.scope);
    if (object === null) return null;
    found.push(object);
  }
  return found;
}

/**
 * The objects an inactive-objects list names, in either form SAP answers it —
 * or `null` when the document is not one: not a well-formed XML string, no
 * single root, a root of another name or namespace, or an element in it this
 * form does not have (an entry, object or reference of another name, text in
 * their place). An empty list is `[]`.
 */
export function readInactiveList(
  document: unknown,
): IListedInactiveObject[] | null {
  if (typeof document !== 'string' || document.trim() === '') return null;
  if (XMLValidator.validate(document) !== true) return null;
  const parsed = parsedText(parser, document);
  if (!isElement(parsed) || Array.isArray(parsed)) return null;
  const top: ParsedElement = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith('?')) top[key] = value;
  }
  const roots = childrenOf(top, new Map());
  if (roots === null || roots.length !== 1) return null;
  const [root] = roots;
  if (root === undefined) return null;
  if (is(root, IOC, 'inactiveObjects')) return iocList(root);
  if (is(root, ADTCORE, 'objectReferences')) return flatList(root);
  return null;
}
