/**
 * `patchFunctionGroupDocument`: the description on the root, every other byte
 * as SAP sent it — on both releases' measured documents.
 */
import { patchFunctionGroupDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
  without,
} from '../documentFixtures';

function patched(document: string, description: string): string {
  const answer = patchFunctionGroupDocument(document, { description });
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

function rootDescriptionOf(text: string): string {
  const root = text.slice(0, text.indexOf('>', text.indexOf('<group:')));
  return (root.split(' adtcore:description="')[1] ?? '').split('"')[0] ?? '';
}

describe.each(RELEASES)('patchFunctionGroupDocument (%s)', (release) => {
  const read = documentOf(release, 'function-group');
  const description = rootDescriptionOf(read);

  it('writes the description on the root', () => {
    expect(
      onlyChanged(read, patched(read, 'Renamed'), [
        [
          `adtcore:description="${description}"`,
          'adtcore:description="Renamed"',
        ],
      ]),
    ).toBe(true);
  });

  it('adds it to a fresh root, a package reference that carries one untouched', () => {
    // The measured reads' package reference carries no description; a fresh
    // object's read-back of other types does, so this is hand-made from the
    // measured document: no description on the root, one on the reference.
    const fresh = replacing(
      without(read, ` adtcore:description="${description}"`),
      '<adtcore:packageRef ',
      '<adtcore:packageRef adtcore:description="The package" ',
    );
    const out = patched(fresh, 'Fresh');
    const rootEnd = fresh.indexOf(
      '>',
      fresh.indexOf('<group:abapFunctionGroup'),
    );
    expect(out).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
  });

  it('passes a description beyond the 40 SAP takes as given', () => {
    const long = 'F'.repeat(41);
    expect(read).toContain('adtcore:descriptionTextLimit="40"');
    expect(rootDescriptionOf(patched(read, long))).toBe(long);
  });

  it('refuses another type’s document', () => {
    expect(
      patchFunctionGroupDocument(documentOf(release, 'message-class'), {
        description: 'x',
      }),
    ).toEqual({
      ok: false,
      refusal: { kind: 'not-this-type', root: 'mc:messageClass' },
    });
  });
});
