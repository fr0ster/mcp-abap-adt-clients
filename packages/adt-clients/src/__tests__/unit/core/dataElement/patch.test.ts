/**
 * `patchDataElementDocument`: each field at its path in SAP's form, every
 * other byte as SAP sent it — on both releases' measured documents.
 */
import { patchDataElementDocument } from '../../../../index';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  without,
} from '../documentFixtures';

function patched(
  document: string,
  changes: Parameters<typeof patchDataElementDocument>[1],
): string {
  const answer = patchDataElementDocument(document, changes);
  if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
  return answer.document;
}

describe.each(RELEASES)('patchDataElementDocument (%s)', (release) => {
  const shared = documentOf(release, 'data-element-shared');
  const standard = documentOf(release, 'data-element-standard');

  it('writes the description on blue:wbobj, the package reference untouched', () => {
    const out = patched(standard, { description: 'Company' });
    expect(
      onlyChanged(standard, out, [
        [
          'adtcore:description="Buchungskreis"',
          'adtcore:description="Company"',
        ],
      ]),
    ).toBe(true);
    expect(out).toContain('adtcore:description="FI Cross-application Objects"');
  });

  it('adds the description to a fresh root, never to the package reference', () => {
    const fresh = without(
      shared,
      ' adtcore:description="Shared data element for the authorization field tests"',
    );
    const out = patched(fresh, { description: 'Fresh' });
    const rootEnd = fresh.indexOf('>', fresh.indexOf('<blue:wbobj'));
    expect(out).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
  });

  it('writes the type kind, name and predefined type', () => {
    const out = patched(shared, {
      typeKind: 'predefinedAbapType',
      typeName: '',
      dataType: 'NUMC',
      length: 8,
      decimals: 0,
    });
    expect(
      onlyChanged(shared, out, [
        [
          '<dtel:typeKind>domain</dtel:typeKind>',
          '<dtel:typeKind>predefinedAbapType</dtel:typeKind>',
        ],
        ['<dtel:typeName>ZAC_SHR_GA_DOM</dtel:typeName>', '<dtel:typeName/>'],
        [
          '<dtel:dataType>CHAR</dtel:dataType>',
          '<dtel:dataType>NUMC</dtel:dataType>',
        ],
        [
          '<dtel:dataTypeLength>000010</dtel:dataTypeLength>',
          '<dtel:dataTypeLength>000008</dtel:dataTypeLength>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes the type name as given', () => {
    expect(patched(shared, { typeName: 'zac_other_dom' })).toContain(
      '<dtel:typeName>zac_other_dom</dtel:typeName>',
    );
  });

  it('writes the labels and their lengths in two digits, the max lengths untouched', () => {
    const out = patched(shared, {
      shortLabel: 'Short',
      shortLength: 6,
      mediumLabel: 'Medium',
      mediumLength: 12,
      longLabel: 'Long label',
      longLength: 30,
      headingLabel: 'Head',
      headingLength: 4,
    });
    expect(
      onlyChanged(shared, out, [
        [
          '<dtel:shortFieldLabel/>',
          '<dtel:shortFieldLabel>Short</dtel:shortFieldLabel>',
        ],
        [
          '<dtel:shortFieldLength>10</dtel:shortFieldLength>',
          '<dtel:shortFieldLength>06</dtel:shortFieldLength>',
        ],
        [
          '<dtel:mediumFieldLabel/>',
          '<dtel:mediumFieldLabel>Medium</dtel:mediumFieldLabel>',
        ],
        [
          '<dtel:mediumFieldLength>20</dtel:mediumFieldLength>',
          '<dtel:mediumFieldLength>12</dtel:mediumFieldLength>',
        ],
        [
          '<dtel:longFieldLabel/>',
          '<dtel:longFieldLabel>Long label</dtel:longFieldLabel>',
        ],
        [
          '<dtel:longFieldLength>40</dtel:longFieldLength>',
          '<dtel:longFieldLength>30</dtel:longFieldLength>',
        ],
        [
          '<dtel:headingFieldLabel/>',
          '<dtel:headingFieldLabel>Head</dtel:headingFieldLabel>',
        ],
        [
          '<dtel:headingFieldLength>55</dtel:headingFieldLength>',
          '<dtel:headingFieldLength>04</dtel:headingFieldLength>',
        ],
      ]),
    ).toBe(true);
  });

  it('never derives a label length from the label', () => {
    expect(
      onlyChanged(standard, patched(standard, { shortLabel: 'Company code' }), [
        [
          '<dtel:shortFieldLabel>BuKr.</dtel:shortFieldLabel>',
          '<dtel:shortFieldLabel>Company code</dtel:shortFieldLabel>',
        ],
      ]),
    ).toBe(true);
  });

  it('writes the search help, its parameter and the SET/GET parameter', () => {
    const out = patched(standard, {
      searchHelp: '',
      searchHelpParameter: '',
      setGetParameter: 'XYZ',
    });
    expect(
      onlyChanged(standard, out, [
        ['<dtel:searchHelp>C_T001</dtel:searchHelp>', '<dtel:searchHelp/>'],
        [
          '<dtel:searchHelpParameter>BUKRS</dtel:searchHelpParameter>',
          '<dtel:searchHelpParameter/>',
        ],
        [
          '<dtel:setGetParameter>BUK</dtel:setGetParameter>',
          '<dtel:setGetParameter>XYZ</dtel:setGetParameter>',
        ],
      ]),
    ).toBe(true);
  });

  it('refuses a document whose content is not where SAP writes it', () => {
    const elsewhere = shared.split('dtel:dataElement').join('dtel:other');
    expect(patchDataElementDocument(elsewhere, { dataType: 'CHAR' })).toEqual({
      ok: false,
      refusal: {
        kind: 'element-missing',
        field: 'dataType',
        path: 'blue:wbobj/dtel:dataElement/dtel:dataType',
      },
    });
  });
});
