/**
 * An ADT document read as a tree, for the test helpers that judge one.
 *
 * Parsed with the repository's XML parser rather than matched with patterns:
 * attribute order, whitespace and namespace prefixes do not change what is
 * found. Prefixes are dropped (`removeNSPrefix`), attributes are `@_name`.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type XmlElement = Record<string, unknown>;

/** The parsed document; a text that is not XML throws, naming `what`. */
export function parseXmlDocument(text: string, what: string): unknown {
  const valid = XMLValidator.validate(text);
  if (valid !== true) {
    throw new Error(
      `${what} is not XML: ${valid.err.msg} (line ${valid.err.line})`,
    );
  }
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  }).parse(text);
}

/** Every element named `name`, anywhere under `node`. */
export function elementsNamed(node: unknown, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('@_')) continue;
      if (key === name) {
        for (const item of Array.isArray(child) ? child : [child]) {
          // A text-only element parses as its text: kept as `#text`.
          found.push(
            item && typeof item === 'object'
              ? (item as XmlElement)
              : item === undefined || item === null || item === ''
                ? {}
                : { '#text': item },
          );
        }
      }
      visit(child);
    }
  };
  visit(node);
  return found;
}

/** An attribute's value, `''` when the element has none. */
export function attributeOf(element: XmlElement, name: string): string {
  const value = element[`@_${name}`];
  return value === undefined || value === null ? '' : String(value);
}

/** The text of an element's child `name` (or of the element itself), `''` when none. */
export function textOf(element: XmlElement, name?: string): string {
  const node = name === undefined ? element : element[name];
  const first = Array.isArray(node) ? node[0] : node;
  if (first === undefined || first === null) return '';
  if (typeof first !== 'object') return String(first);
  const text = (first as XmlElement)['#text'];
  return text === undefined ? '' : String(text);
}

/** The values of attribute `name` on every element under `node`, in order. */
export function attributeValues(node: unknown, name: string): string[] {
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === `@_${name}`) found.push(String(child));
      else if (!key.startsWith('@_')) visit(child);
    }
  };
  visit(node);
  return found;
}
