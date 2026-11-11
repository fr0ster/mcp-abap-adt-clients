/**
 * `patchTableTypeDocument`: each field at its path in SAP's form, every other
 * byte as SAP sent it — on both releases' measured documents.
 */
import { patchTableTypeDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
  without,
} from '../documentFixtures';

function patched(
  document: string,
  changes: Parameters<typeof patchTableTypeDocument>[1],
): string {
  const answer = patchTableTypeDocument(document, changes);
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

/** The first `<name>…</name>` of the text. */
function elementText(text: string, name: string): string {
  const open = `<${name}>`;
  const start = text.indexOf(open);
  const end = text.indexOf(`</${name}>`, start);
  if (start < 0 || end < 0) throw new Error(`no ${name}`);
  return text.slice(start, end + name.length + 3);
}

function segment(text: string, open: string, close: string): string {
  const start = text.indexOf(open);
  const end = text.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error(`no ${open}`);
  return text.slice(start, end + close.length);
}

describe.each(RELEASES)('patchTableTypeDocument (%s)', (release) => {
  const read = documentOf(release, 'table-type');
  const rootDescription = (
    read
      .slice(0, read.indexOf('>', read.indexOf('<ttyp:tableType')))
      .split(' adtcore:description="')[1] ?? ''
  ).split('"')[0];
  const VALUE_HELPS = ['<ttyp:valueHelps>', '</ttyp:valueHelps>'] as const;

  it('writes the description on the root; the value helps untouched', () => {
    const out = patched(read, { description: 'Renamed' });
    expect(
      onlyChanged(read, out, [
        [
          `adtcore:description="${rootDescription}"`,
          'adtcore:description="Renamed"',
        ],
      ]),
    ).toBe(true);
    expect(segment(out, ...VALUE_HELPS)).toBe(segment(read, ...VALUE_HELPS));
  });

  it('adds the description to a fresh root, never to the package reference', () => {
    const fresh = without(read, ` adtcore:description="${rootDescription}"`);
    const out = patched(fresh, { description: 'Fresh' });
    const rootEnd = fresh.indexOf('>', fresh.indexOf('<ttyp:tableType'));
    expect(out).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
  });

  it('writes the row type', () => {
    const out = patched(read, {
      rowTypeKind: 'predefinedAbapType',
      rowTypeName: '',
      dataType: 'CHAR',
      length: 30,
      decimals: 0,
    });
    expect(
      onlyChanged(read, out, [
        [
          elementText(read, 'ttyp:typeKind'),
          '<ttyp:typeKind>predefinedAbapType</ttyp:typeKind>',
        ],
        [elementText(read, 'ttyp:typeName'), '<ttyp:typeName/>'],
        [
          '<ttyp:dataType>STRU</ttyp:dataType>',
          '<ttyp:dataType>CHAR</ttyp:dataType>',
        ],
        [
          '<ttyp:length>000000</ttyp:length>',
          '<ttyp:length>000030</ttyp:length>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes the decimals in six digits', () => {
    expect(patched(read, { decimals: 3 })).toContain(
      '<ttyp:decimals>000003</ttyp:decimals>',
    );
  });

  it('writes the access type and the primary key', () => {
    const out = patched(read, {
      accessType: 'sorted',
      keyDefinition: 'rowType',
      keyKind: 'unique',
    });
    expect(
      onlyChanged(read, out, [
        [
          elementText(read, 'ttyp:accessType'),
          '<ttyp:accessType>sorted</ttyp:accessType>',
        ],
        [
          elementText(read, 'ttyp:definition'),
          '<ttyp:definition>rowType</ttyp:definition>',
        ],
        [elementText(read, 'ttyp:kind'), '<ttyp:kind>unique</ttyp:kind>'],
      ]),
    ).toBe(true);
  });

  it('finds the primary key by its path, a secondary key of the same names before it untouched', () => {
    // Hand-made from the measured document: a secondary key carrying
    // `ttyp:definition` and `ttyp:kind`, its block placed before the primary key.
    const secondary = segment(
      read,
      '<ttyp:secondaryKeys',
      '</ttyp:secondaryKeys>',
    );
    const withKey = replacing(
      secondary,
      '</ttyp:secondaryKeys>',
      '<ttyp:secondaryKey><ttyp:definition>rowType</ttyp:definition><ttyp:kind>nonUnique</ttyp:kind></ttyp:secondaryKey></ttyp:secondaryKeys>',
    );
    const variant = replacing(
      without(read, secondary),
      '<ttyp:primaryKey',
      `${withKey}<ttyp:primaryKey`,
    );
    const out = patched(variant, {
      keyDefinition: 'keyComponents',
      keyKind: 'unique',
    });
    expect(segment(out, '<ttyp:secondaryKeys', '</ttyp:secondaryKeys>')).toBe(
      withKey,
    );
    const primary = segment(out, '<ttyp:primaryKey', '</ttyp:primaryKey>');
    expect(primary).toContain(
      '<ttyp:definition>keyComponents</ttyp:definition>',
    );
    expect(primary).toContain('<ttyp:kind>unique</ttyp:kind>');
  });
});
