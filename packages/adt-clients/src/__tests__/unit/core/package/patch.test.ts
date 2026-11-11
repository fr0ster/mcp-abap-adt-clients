/**
 * `patchPackageDocument`: each field at its path in SAP's form, every other
 * byte as SAP sent it — on both releases' measured documents.
 *
 * A package document names other packages three times over — its own
 * reference, its super package and each sub package — and each carries an
 * `adtcore:description` of that other package.
 */
import { patchPackageDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
  without,
} from '../documentFixtures';

function patched(
  document: string,
  changes: Parameters<typeof patchPackageDocument>[1],
): string {
  const answer = patchPackageDocument(document, changes);
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

function startTag(text: string, name: string): string {
  const start = text.indexOf(`<${name} `);
  if (start < 0) throw new Error(`no ${name}`);
  return text.slice(start, text.indexOf('>', start) + 1);
}

function segment(text: string, open: string, close: string): string {
  const start = text.indexOf(open);
  const end = text.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error(`no ${open}`);
  return text.slice(start, end + close.length);
}

function attributeOf(tag: string, name: string): string {
  return (tag.split(` ${name}="`)[1] ?? '').split('"')[0] ?? '';
}

const SUB_PACKAGES = ['<pak:subPackages>', '</pak:subPackages>'] as const;

describe.each(RELEASES)('patchPackageDocument (%s)', (release) => {
  const read = documentOf(release, 'package-build');
  const root = startTag(read, 'pak:package');
  const description = attributeOf(root, 'adtcore:description');
  const superPackage = startTag(read, 'pak:superPackage');
  const attributes = startTag(read, 'pak:attributes');

  it('writes the description on the root, the references beside it untouched', () => {
    const out = patched(read, { description: 'Renamed' });
    expect(
      onlyChanged(read, out, [
        [
          `adtcore:description="${description}"`,
          'adtcore:description="Renamed"',
        ],
      ]),
    ).toBe(true);
    expect(startTag(out, 'adtcore:packageRef')).toBe(
      startTag(read, 'adtcore:packageRef'),
    );
  });

  it('adds it to a fresh root; the package reference, super and sub packages untouched', () => {
    const fresh = without(read, ` adtcore:description="${description}"`);
    const out = patched(fresh, { description: 'Fresh' });
    const rootEnd = fresh.indexOf('>', fresh.indexOf('<pak:package'));
    expect(out).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
    expect(startTag(out, 'pak:superPackage')).toBe(superPackage);
    expect(segment(out, ...SUB_PACKAGES)).toBe(segment(read, ...SUB_PACKAGES));
  });

  it('writes the responsible and the master system on the root', () => {
    const out = patched(read, {
      responsible: 'SAPUSER02',
      masterSystem: 'ABC',
    });
    expect(
      onlyChanged(read, out, [
        ['adtcore:responsible="SAPUSER01"', 'adtcore:responsible="SAPUSER02"'],
        ['adtcore:masterSystem="SYS"', 'adtcore:masterSystem="ABC"'],
      ]),
    ).toBe(true);
  });

  it('writes the package type and change recording on pak:attributes', () => {
    const recording = attributeOf(attributes, 'pak:recordChanges');
    const flipped = recording === 'true' ? 'false' : 'true';
    const out = patched(read, {
      packageType: 'structure',
      recordChanges: flipped === 'true',
    });
    expect(
      onlyChanged(read, out, [
        ['pak:packageType="development"', 'pak:packageType="structure"'],
        [`pak:recordChanges="${recording}"`, `pak:recordChanges="${flipped}"`],
      ]),
    ).toBe(true);
  });

  it('changes the super package by name alone, dropping the old target', () => {
    expect(
      onlyChanged(read, patched(read, { superPackage: 'ZAC_SHR_PKG' }), [
        [superPackage, '<pak:superPackage adtcore:name="ZAC_SHR_PKG"/>'],
      ]),
    ).toBe(true);
  });

  it('writes the software component and transport layer under pak:transport', () => {
    const component = startTag(read, 'pak:softwareComponent');
    const layer = startTag(read, 'pak:transportLayer');
    const out = patched(read, {
      softwareComponent: 'ZCOMP',
      transportLayer: 'ZLAYER',
    });
    expect(
      onlyChanged(read, out, [
        [
          component,
          component.replace(
            `pak:name="${attributeOf(component, 'pak:name')}"`,
            'pak:name="ZCOMP"',
          ),
        ],
        [
          layer,
          layer.replace(
            `pak:name="${attributeOf(layer, 'pak:name')}"`,
            'pak:name="ZLAYER"',
          ),
        ],
      ]),
    ).toBe(true);
  });

  it('finds them by the pak:transport path, never the first element of that name', () => {
    // Hand-made from the measured document: elements of the same names
    // before pak:transport.
    const decoy =
      '<pak:decoy><pak:softwareComponent pak:name="DECOY"/><pak:transportLayer pak:name="DECOY"/></pak:decoy>';
    const variant = replacing(
      read,
      '<pak:transport>',
      `${decoy}<pak:transport>`,
    );
    const out = patched(variant, {
      softwareComponent: 'ZCOMP',
      transportLayer: 'ZLAYER',
    });
    expect(out).toContain(decoy);
    const transport = segment(out, '<pak:transport>', '</pak:transport>');
    expect(transport).toContain('<pak:softwareComponent pak:name="ZCOMP"');
    expect(transport).toContain('<pak:transportLayer pak:name="ZLAYER"');
  });
});
