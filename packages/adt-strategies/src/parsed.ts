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
