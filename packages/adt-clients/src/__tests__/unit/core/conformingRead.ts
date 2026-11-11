/**
 * What a conforming XML processor hands its application, for the tests that
 * prove a value written into a document reads back as given.
 */
import { XMLParser } from 'fast-xml-parser';
import {
  applySplices,
  type ElementLocation,
  type Splice,
  scanDocument,
} from '../../../utils/documentEdit';

/**
 * The document as a conforming XML processor reads it: line ends normalised
 * to LF (XML 1.0 §2.11), then every literal white-space character in an
 * attribute value read as a space (§3.3.3), then the references resolved.
 * fast-xml-parser resolves the references but skips both normalisations, so
 * they are applied to the text before it parses.
 */
export function conformingRead(document: string): unknown {
  const lines = document.split('\r\n').join('\n').split('\r').join('\n');
  const root = scanDocument(lines);
  if (root === undefined) throw new Error('not a document');
  const splices: Splice[] = [];
  const visit = (element: ElementLocation): void => {
    for (const attribute of element.attributes) {
      const raw = lines.slice(attribute.value.start, attribute.value.end);
      splices.push({
        ...attribute.value,
        text: raw.split('\t').join(' ').split('\n').join(' '),
      });
    }
    for (const child of element.children) visit(child);
  };
  visit(root);
  return new XMLParser({
    ignoreAttributes: false,
    htmlEntities: true,
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(applySplices(lines, splices));
}

/** The parsed node at `path`, each step an element or an `@_` attribute. */
export function readAt(node: unknown, path: readonly string[]): unknown {
  let current = node;
  for (const step of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    let next: unknown;
    for (const [key, value] of Object.entries(current)) {
      if (key === step) next = value;
    }
    current = next;
  }
  return current;
}

/** Every value of the attribute `name` (`@_…`) in a parsed document, in document order. */
export function attributesNamed(node: unknown, name: string): string[] {
  const values: string[] = [];
  const walk = (current: unknown): void => {
    if (typeof current !== 'object' || current === null) return;
    for (const [key, value] of Object.entries(current)) {
      if (key === name && typeof value === 'string') values.push(value);
      else walk(value);
    }
  };
  walk(node);
  return values;
}
