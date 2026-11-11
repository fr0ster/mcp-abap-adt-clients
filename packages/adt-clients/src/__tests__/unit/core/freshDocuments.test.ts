/**
 * A freshly created object, read before its first activation: SAP answers a
 * root without `adtcore:description`, and the package reference beside it
 * carries the package's own. Recorded from the domain's, the data element's
 * and the table type's live suites on both releases. The patch adds the
 * description on the root and leaves every other byte as SAP sent it.
 */
import {
  patchDataElementDocument,
  patchDomainDocument,
  patchTableTypeDocument,
} from '../../../index';
import { documentOf, RELEASES } from './documentFixtures';

/** The root's start tag: from `<root` to the first `>` after it. */
function rootStartTag(document: string, root: string): string {
  const start = document.indexOf(`<${root}`);
  return document.slice(start, document.indexOf('>', start));
}

const FRESH = [
  {
    readCase: 'domain-fresh',
    root: 'doma:domain',
    patch: (document: string) =>
      patchDomainDocument(document, { description: 'Fresh domain' }),
    description: 'Fresh domain',
  },
  {
    readCase: 'data-element-fresh',
    root: 'blue:wbobj',
    patch: (document: string) =>
      patchDataElementDocument(document, {
        description: 'Fresh data element',
      }),
    description: 'Fresh data element',
  },
  {
    readCase: 'table-type-fresh',
    root: 'ttyp:tableType',
    patch: (document: string) =>
      patchTableTypeDocument(document, { description: 'Fresh table type' }),
    description: 'Fresh table type',
  },
] as const;

describe.each(RELEASES)('a fresh read-back (%s)', (release) => {
  describe.each(FRESH)(
    '$readCase',
    ({ readCase, root, patch, description }) => {
      const fresh = documentOf(release, readCase);

      it('carries no description on the root, and one on the package reference', () => {
        expect(rootStartTag(fresh, root)).not.toContain('adtcore:description=');
        const reference = fresh.slice(fresh.indexOf('<adtcore:packageRef'));
        expect(reference.slice(0, reference.indexOf('>'))).toContain(
          'adtcore:description=',
        );
      });

      it('gets the description added on the root, every other byte as read', () => {
        const answer = patch(fresh);
        if (!answer.ok) throw new Error(`refused: ${JSON.stringify(answer)}`);
        const rootEnd = fresh.indexOf('>', fresh.indexOf(`<${root}`));
        expect(answer.document).toBe(
          `${fresh.slice(0, rootEnd)} adtcore:description="${description}"${fresh.slice(rootEnd)}`,
        );
      });
    },
  );
});
