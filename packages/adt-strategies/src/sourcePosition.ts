/**
 * A position in a source, as ADT writes it in a reference's fragment:
 * `<uri>#start=<line>,<column>[;end=<line>,<column>]` — lines from 1, columns
 * from 0, `end` exclusive (measured on the outline's links, and the same
 * fragment rides on a checklist `msg`'s `href` and a check run's `uri`).
 *
 * Plain string code: the fragment is split on `;`, `=` and `,`, and a number
 * is decimal digits and nothing else.
 */

/** A point in a source: line from 1, column from 0. */
export interface AdtSourcePoint {
  readonly line: number;
  readonly column: number;
}

/** Where a message stands: its start, and its end (exclusive) where SAP gives one. */
export interface AdtSourcePosition extends AdtSourcePoint {
  readonly end?: AdtSourcePoint;
}

/** A non-negative integer written in decimal digits, else `undefined`. */
function digits(text: string): number | undefined {
  if (text.length === 0) return undefined;
  for (const character of text) {
    if (character < '0' || character > '9') return undefined;
  }
  return Number(text);
}

/** `l,c`, or `undefined` when the text is not one. */
export function sourcePoint(
  text: string | undefined,
): AdtSourcePoint | undefined {
  if (text === undefined) return undefined;
  const comma = text.indexOf(',');
  if (comma === -1) return undefined;
  const line = digits(text.slice(0, comma));
  const column = digits(text.slice(comma + 1));
  return line === undefined || column === undefined
    ? undefined
    : { line, column };
}

/** The `key=value` pairs of a fragment, split on `;`. */
export function fragmentPairs(fragment: string): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const part of fragment.split(';')) {
    const equals = part.indexOf('=');
    if (equals > 0) pairs.set(part.slice(0, equals), part.slice(equals + 1));
  }
  return pairs;
}

/** A reference split into the resource it names and the position it marks. */
export interface AdtSourceReference {
  /** The reference before its `#`; absent for an empty reference. */
  readonly uri?: string;
  /** The fragment's position; absent when there is none or it does not read. */
  readonly position?: AdtSourcePosition;
}

/**
 * A reference as SAP wrote it, split. A fragment that is not a position — none,
 * a `#type=…;name=…` target, a `start` or an `end` that does not read — gives
 * the uri alone; an empty reference gives nothing.
 */
export function readSourceReference(
  reference: string | undefined,
): AdtSourceReference {
  if (reference === undefined || reference === '') return {};
  const hash = reference.indexOf('#');
  if (hash === -1) return { uri: reference };
  const uri = reference.slice(0, hash);
  const located: AdtSourceReference = uri === '' ? {} : { uri };
  const pairs = fragmentPairs(reference.slice(hash + 1));
  const start = sourcePoint(pairs.get('start'));
  if (start === undefined) return located;
  const endText = pairs.get('end');
  if (endText === undefined) return { ...located, position: start };
  const end = sourcePoint(endText);
  if (end === undefined) return located;
  return { ...located, position: { ...start, end } };
}
