/**
 * The root element's `adtcore:description` of an ADT document, read and
 * replaced in plain string code.
 *
 * The metadata-update step of the integration flow writes back the document it
 * read with this one value changed. The server gets the document byte for byte
 * as it was read, so nothing here parses and re-serialises it, and nothing
 * matches the whole text with a pattern: the root's opening tag is found, and
 * the attribute is looked for inside that tag alone — a nested element's
 * `adtcore:description` is somebody else's value.
 */

const ATTRIBUTE = 'adtcore:description="';

function isNameStart(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z') ||
      char === '_' ||
      char === ':')
  );
}

/** Where the root's opening tag starts and ends (`end` is its `>`). */
function rootTag(document: string): { start: number; end: number } | undefined {
  // Skip the declaration, comments and a DOCTYPE: the root is the first `<`
  // followed by a name.
  let start = -1;
  for (let at = document.indexOf('<'); at !== -1; ) {
    if (isNameStart(document[at + 1])) {
      start = at;
      break;
    }
    if (document.startsWith('<!--', at)) {
      const close = document.indexOf('-->', at + 4);
      at = close === -1 ? -1 : document.indexOf('<', close + 3);
    } else {
      at = document.indexOf('<', at + 1);
    }
  }
  if (start === -1) return undefined;
  // The tag ends at the first `>` outside a quoted attribute value.
  let quote: string | undefined;
  for (let at = start + 1; at < document.length; at += 1) {
    const char = document[at];
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return { start, end: at };
    }
  }
  return undefined;
}

/** The value's position inside `document`, or `undefined` when the root has none. */
function valueRange(
  document: string,
): { from: number; to: number } | undefined {
  const tag = rootTag(document);
  if (!tag) return undefined;
  const opening = document.slice(tag.start, tag.end);
  let found = opening.indexOf(ATTRIBUTE);
  // The attribute name starts after white space, never inside another name.
  while (found > 0 && !' \t\r\n'.includes(opening[found - 1] ?? 'x')) {
    found = opening.indexOf(ATTRIBUTE, found + 1);
  }
  if (found === -1) return undefined;
  const from = tag.start + found + ATTRIBUTE.length;
  const to = document.indexOf('"', from);
  if (to === -1 || to > tag.end) return undefined;
  return { from, to };
}

/** The root element's `adtcore:description`, or `undefined` when it has none. */
export function readRootDescription(document: string): string | undefined {
  const range = valueRange(document);
  return range ? document.slice(range.from, range.to) : undefined;
}

/**
 * `document` with the root element's `adtcore:description` set to `value`,
 * every other byte as it was. A root without one throws, naming `what`.
 */
export function replaceRootDescription(
  document: string,
  value: string,
  what: string,
): string {
  const range = valueRange(document);
  if (!range) {
    throw new Error(
      `${what}: the metadata document's root element has no ` +
        'adtcore:description, so there is nothing to change.',
    );
  }
  return document.slice(0, range.from) + value + document.slice(range.to);
}
