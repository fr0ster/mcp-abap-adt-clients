/**
 * The error messages a validation answer carries inside its 200.
 *
 * `analyseValidation` (adt-strategies) is passed with the call and judges the
 * forms it knows — SAP's `asx:abap/values/DATA/SEVERITY` envelope among them.
 * An `exc:exception` document is answered as the refusal it is, before any
 * table is read. This reads every other table form a validation may answer with, by
 * structure rather than by prefix: any element, at any depth, whose `type` or
 * `severity` attribute — or whose `TYPE` / `SEVERITY` child — says error. A
 * message nested inside an `errorTable` or a `messageTable` is found as
 * well as one that is the table itself, whatever its namespace prefix.
 */

import { readExceptionRefusal } from '@mcp-abap-adt/adt-strategies';
import {
  attributeOf,
  elementsNamed,
  parseXmlDocument,
  textOf,
  type XmlElement,
} from './xmlTree';

const ERROR = new Set(['E', 'ERROR', 'A', 'ABORT']);

/** Every element under `node`, the node itself first. */
function everyElement(node: unknown): XmlElement[] {
  const found: XmlElement[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    found.push(value as XmlElement);
    for (const [key, child] of Object.entries(value)) {
      if (!key.startsWith('@_')) visit(child);
    }
  };
  visit(node);
  return found;
}

function says(element: XmlElement, name: string): string {
  const attribute = attributeOf(element, name).toUpperCase();
  if (attribute) return attribute;
  // A direct child only: the envelope's own `DATA/SEVERITY`, not one deeper.
  const child = element[name.toUpperCase()];
  const first = Array.isArray(child) ? child[0] : child;
  if (first === undefined || first === null) return '';
  return (
    typeof first === 'object' ? textOf(first as XmlElement) : String(first)
  )
    .trim()
    .toUpperCase();
}

/** The texts of the error messages in `document`; `[]` when it holds none. */
export function validationErrors(document: string): string[] {
  if (document.trim() === '') return [];
  // An exception document is a refusal before anything else: it carries no
  // message table, and read as one it would say "no errors".
  const exception = readExceptionRefusal(document);
  if (exception) return [exception.message];
  const tree = parseXmlDocument(document, 'the validation answer');
  return everyElement(tree)
    .filter(
      (element) =>
        ERROR.has(says(element, 'type')) ||
        ERROR.has(says(element, 'severity')),
    )
    .map(
      (element) =>
        attributeOf(element, 'text') ||
        textOf(element, 'text') ||
        textOf(element, 'SHORT_TEXT') ||
        textOf(element) ||
        '(no text)',
    );
}
