/**
 * The rules every shipped document patch shares, shown through the domain's.
 *
 * A patch returns its answer, never throws for what SAP sent; refuses a
 * document it cannot place whole; changes nothing the caller did not name;
 * writes a description on the object's own root, adding it when the root
 * carries none — never on the package reference beside it.
 */
import { patchDomainDocument } from '../../../../core/domain/patch';
import {
  documentOf,
  onlyChanged,
  RELEASES,
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
  ])('answers not-a-document for %s, without throwing', (_what, text) => {
    expect(patchDomainDocument(text, { description: 'x' })).toEqual({
      ok: false,
      refusal: { kind: 'not-a-document' },
    });
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
