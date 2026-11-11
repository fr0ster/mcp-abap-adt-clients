/**
 * The rules every shipped document patch shares, shown through the domain's.
 *
 * A patch returns its answer, never throws for what SAP sent; refuses a
 * document it cannot place whole; changes nothing the caller did not name;
 * writes a description on the object's own root, adding it when the root
 * carries none — never on the package reference beside it.
 */
import { patchDomainDocument } from '../../../../core/domain/patch';
import { conformingRead, readAt } from '../conformingRead';
import {
  documentOf,
  onlyChanged,
  RELEASES,
  replacing,
  without,
} from '../documentFixtures';

const ROOT_DESCRIPTION =
  ' adtcore:description="Shared domain — base of the group-activation chain"';
const PACKAGE_DESCRIPTION =
  'adtcore:description="Shared test dependencies package"';

describe.each(RELEASES)('the shared rules (%s)', (release) => {
  const read = documentOf(release, 'domain-shared');

  it.each([
    ['empty', ''],
    ['blank', '  \n'],
    ['not XML', 'Request failed with status code 500'],
    ['cut short', read.slice(0, read.indexOf('<doma:content>') + 20)],
    ['another element before the root', '<other/><doma:domain/>'],
    ['another element after the root', `${read}<other/>`],
    ['-- in a comment', '<doma:domain><!-- a--b --></doma:domain>'],
    ['a comment ending in --->', '<doma:domain><!-- a ---></doma:domain>'],
    ['a literal NUL in text', '<doma:domain>a\u0000b</doma:domain>'],
    [
      'a literal NUL in CDATA',
      '<doma:domain><![CDATA[a\u0000b]]></doma:domain>',
    ],
    ['U+0001 in an attribute', '<doma:domain a="\u0001"/>'],
    ['a lone surrogate in text', '<doma:domain>\ud800</doma:domain>'],
    [
      'a literal NUL in the document SAP sent',
      read.replace('</doma:domain>', '\u0000</doma:domain>'),
    ],
  ])('answers not-a-document for %s, without throwing', (_what, text) => {
    expect(patchDomainDocument(text, { description: 'x' })).toEqual({
      ok: false,
      refusal: { kind: 'not-a-document' },
    });
  });

  it('accepts a leading BOM before a bare root and keeps it', () => {
    expect(
      patchDomainDocument('\ufeff<doma:domain/>', { description: 'x' }),
    ).toEqual({
      ok: true,
      document: '\ufeff<doma:domain adtcore:description="x"/>',
    });
  });

  it('accepts a leading BOM before the namespaced root and keeps it', () => {
    const plain = patchDomainDocument(read, { description: 'x', length: 4 });
    const withBom = patchDomainDocument(`\ufeff${read}`, {
      description: 'x',
      length: 4,
    });
    if (!plain.ok || !withBom.ok) throw new Error('refused');
    expect(withBom.document).toBe(`\ufeff${plain.document}`);
  });

  it('answers not-this-type for another type’s document, naming its root', () => {
    const tableType = documentOf(release, 'table-type');
    expect(patchDomainDocument(tableType, { description: 'x' })).toEqual({
      ok: false,
      refusal: { kind: 'not-this-type', root: 'ttyp:tableType' },
    });
  });

  it('names the first missing field in declaration order and returns no document', () => {
    const shell = without(
      read,
      read.slice(
        read.indexOf('<doma:content>'),
        read.indexOf('</doma:content>') + '</doma:content>'.length,
      ),
    );
    const answer = patchDomainDocument(shell, {
      length: 4,
      description: 'kept out',
      dataType: 'CHAR',
    });
    expect(answer).toEqual({
      ok: false,
      refusal: {
        kind: 'element-missing',
        field: 'dataType',
        path: 'doma:domain/doma:content/doma:typeInformation/doma:datatype',
      },
    });
    expect('document' in answer).toBe(false);
  });

  it('gives the input back when no field is named', () => {
    expect(patchDomainDocument(read, {})).toEqual({ ok: true, document: read });
  });

  it('leaves a field left undefined byte-equal', () => {
    const answer = patchDomainDocument(read, {
      dataType: undefined,
      conversionExit: undefined,
      description: 'New',
    });
    if (!answer.ok) throw new Error('refused');
    expect(
      onlyChanged(read, answer.document, [
        [
          'adtcore:description="Shared domain — base of the group-activation chain"',
          'adtcore:description="New"',
        ],
      ]),
    ).toBe(true);
  });

  it("writes '' as the empty element SAP answers for an empty value", () => {
    const answer = patchDomainDocument(read, { dataType: '' });
    if (!answer.ok) throw new Error('refused');
    expect(
      onlyChanged(read, answer.document, [
        ['<doma:datatype>CHAR</doma:datatype>', '<doma:datatype/>'],
      ]),
    ).toBe(true);
  });

  it('sets the description on the root, the package reference byte-equal', () => {
    const answer = patchDomainDocument(read, { description: 'Renamed' });
    if (!answer.ok) throw new Error('refused');
    expect(
      onlyChanged(read, answer.document, [
        [ROOT_DESCRIPTION, ' adtcore:description="Renamed"'],
      ]),
    ).toBe(true);
    expect(answer.document).toContain(PACKAGE_DESCRIPTION);
  });

  it('adds the description to a root that carries none, the package reference byte-equal', () => {
    const fresh = without(read, ROOT_DESCRIPTION);
    const answer = patchDomainDocument(fresh, { description: 'Fresh' });
    if (!answer.ok) throw new Error('refused');
    const rootEnd = fresh.indexOf('>', fresh.indexOf('<doma:domain'));
    expect(answer.document).toBe(
      `${fresh.slice(0, rootEnd)} adtcore:description="Fresh"${fresh.slice(rootEnd)}`,
    );
    expect(answer.document).toContain(PACKAGE_DESCRIPTION);
  });
});

describe.each(RELEASES)('values reach the reader as given (%s)', (release) => {
  const read = documentOf(release, 'domain-shared');
  const DESCRIPTION = ['doma:domain', '@_adtcore:description'];
  const CONVERSION_EXIT = [
    'doma:domain',
    'doma:content',
    'doma:outputInformation',
    'doma:conversionExit',
  ];

  it.each([
    ['a line feed', 'a\nb'],
    ['a tab', 'a\tb'],
    ['a carriage return', 'a\rb'],
    ['CR LF', 'a\r\nb'],
    ['all of them', 'a\nb\tc\rd\r\ne'],
    ['the escaped characters', `a&b<c>d"e'f`],
  ])('keeps %s in a double-quoted attribute and in text', (_what, value) => {
    const answer = patchDomainDocument(read, {
      description: value,
      conversionExit: value,
    });
    if (!answer.ok) throw new Error('refused');
    const parsed = conformingRead(answer.document);
    expect(readAt(parsed, DESCRIPTION)).toBe(value);
    expect(readAt(parsed, CONVERSION_EXIT)).toBe(value);
  });

  it.each([
    ['all the white space', 'a\nb\tc\rd\r\ne'],
    ['the escaped characters', `a&b<c>d"e'f`],
  ])('keeps %s in a single-quoted attribute', (_what, value) => {
    const quoted = replacing(
      read,
      ' adtcore:description="Shared domain — base of the group-activation chain"',
      " adtcore:description='Shared domain'",
    );
    const answer = patchDomainDocument(quoted, { description: value });
    if (!answer.ok) throw new Error('refused');
    expect(readAt(conformingRead(answer.document), DESCRIPTION)).toBe(value);
  });

  it('keeps the white space in an attribute the patch adds', () => {
    const value = 'a\nb\tc\rd';
    const answer = patchDomainDocument(without(read, ROOT_DESCRIPTION), {
      description: value,
    });
    if (!answer.ok) throw new Error('refused');
    expect(readAt(conformingRead(answer.document), DESCRIPTION)).toBe(value);
  });

  it.each([
    ['a bare &', 'a & b'],
    ['an undefined entity', '&foo;'],
    ['a malformed character reference', '&#xZZ;'],
  ])(
    'answers not-a-document for %s in a description SAP sent',
    (_what, raw) => {
      const broken = replacing(
        read,
        ' adtcore:description="Shared domain — base of the group-activation chain"',
        ` adtcore:description="${raw}"`,
      );
      expect(patchDomainDocument(broken, { description: 'x' })).toEqual({
        ok: false,
        refusal: { kind: 'not-a-document' },
      });
    },
  );
});
