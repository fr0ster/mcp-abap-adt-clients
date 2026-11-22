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
  const parsed: unknown = parser.parse(document);
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
