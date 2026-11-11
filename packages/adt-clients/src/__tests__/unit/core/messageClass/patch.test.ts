/**
 * `patchMessageClassDocument`: the description on the root, every message
 * and every other byte as SAP sent it — on both releases' measured documents.
 */
import { patchMessageClassDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
  without,
} from '../documentFixtures';

function patched(document: string, description: string): string {
  const answer = patchMessageClassDocument(document, { description });
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

/** Every `mc:messages` element, start to end, in document order. */
function messages(text: string): string[] {
  const out: string[] = [];
  let from = text.indexOf('<mc:messages ');
  while (from >= 0) {
    const end = text.indexOf('</mc:messages>', from) + '</mc:messages>'.length;
    out.push(text.slice(from, end));
    from = text.indexOf('<mc:messages ', end);
  }
  return out;
}

describe.each(RELEASES)('patchMessageClassDocument (%s)', (release) => {
  const read = documentOf(release, 'message-class');
  const root = read.slice(
    0,
    read.indexOf('>', read.indexOf('<mc:messageClass')),
  );
  const description =
    (root.split(' adtcore:description="')[1] ?? '').split('"')[0] ?? '';

  it('carries one adtcore:description, the root’s, and messages to keep', () => {
    expect(read.split('adtcore:description=').length - 1).toBe(1);
    expect(messages(read).length).toBeGreaterThan(0);
  });

  it('writes the description on the root, every message byte-equal', () => {
    const out = patched(read, 'Renamed');
    expect(
      onlyChanged(read, out, [
        [
          `adtcore:description="${description}"`,
          'adtcore:description="Renamed"',
        ],
      ]),
    ).toBe(true);
    expect(messages(out)).toEqual(messages(read));
  });

  it('adds it to a fresh root, a package reference that carries one untouched', () => {
    // Hand-made from the measured document, as for the function group.
    const fresh = replacing(
      without(read, ` adtcore:description="${description}"`),
      '<adtcore:packageRef ',
      '<adtcore:packageRef adtcore:description="The package" ',
    );
    const out = patched(fresh, 'Fresh');
    const rootEnd = fresh.indexOf('>', fresh.indexOf('<mc:messageClass'));
    expect(out).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
    expect(messages(out)).toEqual(messages(fresh));
  });
});
