/**
 * `patchDomainDocument`: each field at its path in SAP's form, every other
 * byte as SAP sent it — on both releases' measured documents.
 */
import { patchDomainDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
} from '../documentFixtures';

function patched(
  document: string,
  changes: Parameters<typeof patchDomainDocument>[1],
): string {
  const answer = patchDomainDocument(document, changes);
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

/** The text between the first `open` and the `close` after it, inclusive. */
function segment(text: string, open: string, close: string): string {
  const start = text.indexOf(open);
  const end = text.indexOf(close, start);
  if (start < 0 || end < 0) throw new Error(`no ${open}`);
  return text.slice(start, end + close.length);
}

const OUTPUT = [
  '<doma:outputInformation>',
  '</doma:outputInformation>',
] as const;

describe.each(RELEASES)('patchDomainDocument (%s)', (release) => {
  const shared = documentOf(release, 'domain-shared');
  const valueTable = documentOf(release, 'domain-value-table');
  const fixed = documentOf(release, 'domain-fixed-values');

  it('writes the data type', () => {
    expect(
      onlyChanged(shared, patched(shared, { dataType: 'NUMC' }), [
        [
          '<doma:datatype>CHAR</doma:datatype>',
          '<doma:datatype>NUMC</doma:datatype>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes the type length in six digits, the output length untouched', () => {
    const out = patched(valueTable, { length: 3 });
    expect(
      onlyChanged(valueTable, out, [
        [
          '<doma:length>000005</doma:length>',
          '<doma:length>000003</doma:length>',
        ],
      ]),
    ).toBe(true);
    expect(segment(out, ...OUTPUT)).toBe(segment(valueTable, ...OUTPUT));
    expect(segment(out, ...OUTPUT)).toContain(
      '<doma:length>000005</doma:length>',
    );
  });

  it('finds the type length by its path, not by document order', () => {
    // SAP answers typeInformation first, so the first `doma:length` happens to
    // be the right one; with the output block first only the path finds it.
    const typeBlock = segment(
      valueTable,
      '<doma:typeInformation>',
      '</doma:typeInformation>',
    );
    const outputBlock = segment(valueTable, ...OUTPUT);
    const swapped = replacing(
      replacing(valueTable, typeBlock, '@@TYPE@@'),
      outputBlock,
      typeBlock,
    ).replace('@@TYPE@@', outputBlock);
    const out = patched(swapped, { length: 3 });
    expect(segment(out, ...OUTPUT)).toBe(outputBlock);
    expect(
      segment(out, '<doma:typeInformation>', '</doma:typeInformation>'),
    ).toContain('<doma:length>000003</doma:length>');
  });

  it('writes the decimals in six digits', () => {
    expect(
      onlyChanged(shared, patched(shared, { decimals: 2 }), [
        [
          '<doma:decimals>000000</doma:decimals>',
          '<doma:decimals>000002</doma:decimals>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes a conversion exit into the empty element', () => {
    expect(
      onlyChanged(shared, patched(shared, { conversionExit: 'ALPHA' }), [
        [
          '<doma:conversionExit/>',
          '<doma:conversionExit>ALPHA</doma:conversionExit>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes the flags as true / false', () => {
    expect(
      onlyChanged(
        shared,
        patched(shared, { signExists: true, lowercase: true }),
        [
          [
            '<doma:signExists>false</doma:signExists>',
            '<doma:signExists>true</doma:signExists>',
          ],
          [
            '<doma:lowercase>false</doma:lowercase>',
            '<doma:lowercase>true</doma:lowercase>',
          ],
        ],
      ),
    ).toBe(true);
    const back = patched(
      replacing(shared, '<doma:lowercase>false', '<doma:lowercase>true'),
      { lowercase: false },
    );
    expect(back).toBe(shared);
  });

  it('changes a value table by name alone, dropping the old target', () => {
    expect(
      onlyChanged(valueTable, patched(valueTable, { valueTable: 'T005' }), [
        [
          '<doma:valueTableRef adtcore:uri="/sap/bc/adt/ddic/tables/tcurc" adtcore:type="TABL/DT" adtcore:name="TCURC"/>',
          '<doma:valueTableRef adtcore:name="T005"/>',
        ],
      ]),
    ).toBe(true);
  });

  it('sets a value table on the empty reference SAP answers for none', () => {
    expect(
      onlyChanged(shared, patched(shared, { valueTable: 'ZAC_SHR_VTABL' }), [
        [
          '<doma:valueTableRef/>',
          '<doma:valueTableRef adtcore:name="ZAC_SHR_VTABL"/>',
        ],
      ]),
    ).toBe(true);
  });

  it('replaces the fixed values whole: positions, high given and absent', () => {
    const out = patched(fixed, {
      fixedValues: [
        { low: 'A', high: 'C', text: 'A to C' },
        { low: 'Z', text: 'Zed' },
      ],
    });
    expect(segment(out, '<doma:fixValues>', '</doma:fixValues>')).toBe(
      '<doma:fixValues>' +
        '<doma:fixValue><doma:position>0001</doma:position><doma:low>A</doma:low><doma:high>C</doma:high><doma:text>A to C</doma:text></doma:fixValue>' +
        '<doma:fixValue><doma:position>0002</doma:position><doma:low>Z</doma:low><doma:high/><doma:text>Zed</doma:text></doma:fixValue>' +
        '</doma:fixValues>',
    );
    expect(
      onlyChanged(fixed, out, [
        [
          segment(fixed, '<doma:fixValues>', '</doma:fixValues>'),
          segment(out, '<doma:fixValues>', '</doma:fixValues>'),
        ],
      ]),
    ).toBe(true);
  });

  it('writes an empty low as SAP does', () => {
    const out = patched(fixed, { fixedValues: [{ low: '', text: 'none' }] });
    expect(out).toContain(
      '<doma:fixValue><doma:position>0001</doma:position><doma:low/><doma:high/><doma:text>none</doma:text></doma:fixValue>',
    );
  });

  it('clears the fixed values with []', () => {
    expect(
      onlyChanged(fixed, patched(fixed, { fixedValues: [] }), [
        [
          segment(fixed, '<doma:fixValues>', '</doma:fixValues>'),
          '<doma:fixValues/>',
        ],
      ]),
    ).toBe(true);
  });

  it('fills the empty fixed values SAP answers for none', () => {
    expect(
      onlyChanged(
        shared,
        patched(shared, { fixedValues: [{ low: '1', text: 'one' }] }),
        [
          [
            '<doma:fixValues/>',
            '<doma:fixValues><doma:fixValue><doma:position>0001</doma:position><doma:low>1</doma:low><doma:high/><doma:text>one</doma:text></doma:fixValue></doma:fixValues>',
          ],
        ],
      ),
    ).toBe(true);
  });

  it('escapes what it writes', () => {
    const out = patched(shared, {
      description: 'a "b" & <c>',
      fixedValues: [{ low: '<', text: 'x & y' }],
    });
    expect(out).toContain(
      'adtcore:description="a &quot;b&quot; &amp; &lt;c&gt;"',
    );
    expect(out).toContain(
      '<doma:low>&lt;</doma:low><doma:high/><doma:text>x &amp; y</doma:text>',
    );
  });

  it('passes a long description as given', () => {
    const long = 'D'.repeat(80);
    expect(patched(shared, { description: long })).toContain(
      `adtcore:description="${long}"`,
    );
  });
});
