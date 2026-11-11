/**
 * The measured metadata documents the patch tests run on
 * (`corpus/adt/documents/<release>/`), byte for byte as SAP answered them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RELEASES = ['s4-2025', 'abap-cloud'] as const;
export type Release = (typeof RELEASES)[number];

const DOCUMENTS = join(__dirname, '../../../../corpus/adt/documents');

/** `read-<case>--01-read-metadata.body.txt` of a release. */
export function documentOf(release: Release, readCase: string): string {
  return readFileSync(
    join(DOCUMENTS, release, `read-${readCase}--01-read-metadata.body.txt`),
    'utf8',
  );
}

/**
 * The text with `[from, to)` removed, given as the substrings around it —
 * how a test builds what a fresh object reads back as (no description on
 * the root) from a measured document, until the live run records one.
 */
export function without(text: string, part: string): string {
  const at = text.indexOf(part);
  if (at < 0) throw new Error(`fixture does not hold ${part}`);
  return text.slice(0, at) + text.slice(at + part.length);
}

/** The text with the first `part` replaced, refusing a fixture without it. */
export function replacing(text: string, part: string, by: string): string {
  const at = text.indexOf(part);
  if (at < 0) throw new Error(`fixture does not hold ${part}`);
  return text.slice(0, at) + by + text.slice(at + part.length);
}

/**
 * Whether `after` is `before` with exactly the given replacements, in order:
 * every byte outside them equal.
 */
export function onlyChanged(
  before: string,
  after: string,
  changes: ReadonlyArray<readonly [string, string]>,
): boolean {
  let expected = before;
  let from = 0;
  for (const [part, by] of changes) {
    const at = expected.indexOf(part, from);
    if (at < 0) return false;
    expected = expected.slice(0, at) + by + expected.slice(at + part.length);
    from = at + by.length;
  }
  return expected === after;
}
