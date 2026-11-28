/**
 * `docuPage` against the keyword documentation pages recorded on ABAP cloud
 * and on premise (2026-11-28, fr0ster/mcp-abap-adt#404). Each page's sidecar
 * holds its links as an independent count made them (Python's `html.parser`,
 * in the capture), and the reading must answer them element by element:
 * kind, href, object, version, language, label, order and repetitions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  collapsed,
  type DocuLink,
  docuLink,
  docuPage,
  readDocuPage,
} from '../results/keywordDocumentation';
import { answerFor } from './corpus';

const ANSWERS = join(__dirname, '../../../adt-clients/corpus/adt/answers');

/** The links a page's sidecar recorded. */
function recordedLinks(step: string): DocuLink[] {
  const sidecar = JSON.parse(
    readFileSync(join(ANSWERS, `${step}.json`), 'utf-8'),
  ) as { links: DocuLink[] };
  return sidecar.links;
}

const PAGES = [
  ['read-keyword-documentation-query-abap-cloud', '01-query'],
  ['read-keyword-documentation-no-hit-abap-cloud', '01-query'],
  ['read-keyword-documentation-topic-abap-cloud', '01-topic'],
  ['read-keyword-documentation-topic-link-abap-cloud', '01-topic'],
  ['read-keyword-documentation-query-s4-2025', '01-query'],
  ['read-keyword-documentation-no-hit-s4-2025', '01-query'],
  ['read-keyword-documentation-topic-s4-2025', '01-topic'],
  ['read-keyword-documentation-topic-link-s4-2025', '01-topic'],
] as const;

const wire = (data: string): IAdtWireResponse =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

describe('docuPage on the recorded pages', () => {
  it.each(PAGES)('%s: every link, element by element', (page, step) => {
    const read = docuPage(answerFor(page));
    expect(read).toBeDefined();
    expect(read?.links).toEqual(recordedLinks(`${page}--${step}`));
  });

  it.each(PAGES)('%s: text holds no data: URI and no markup', (page) => {
    const read = docuPage(answerFor(page));
    expect(read?.text).not.toContain('data:');
    expect(read?.text).not.toContain('<');
    expect(read?.text.length).toBeGreaterThan(0);
  });

  it('a page with hits and a topic page are titled by their subject', () => {
    expect(
      docuPage(answerFor('read-keyword-documentation-topic-abap-cloud'))?.title,
    ).toBe('SELECT | ABAP Keyword Documentation');
    expect(
      docuPage(answerFor('read-keyword-documentation-topic-s4-2025'))?.title,
    ).toBe('SELECT | ABAP Keyword Documentation');
    expect(
      docuPage(answerFor('read-keyword-documentation-query-s4-2025'))?.title,
    ).toBe('Results | ABAP Keyword Documentation');
  });

  it('a query with no hit is a page titled "Not found", on both kinds', () => {
    for (const page of [
      'read-keyword-documentation-no-hit-abap-cloud',
      'read-keyword-documentation-no-hit-s4-2025',
    ]) {
      expect(docuPage(answerFor(page))?.title).toBe(
        'Not found | ABAP Keyword Documentation',
      );
    }
  });

  it.each([
    ['read-keyword-documentation-topic-abap-cloud', 'ABAPSELECT'],
    ['read-keyword-documentation-topic-s4-2025', 'ABAPSELECT'],
    ['read-keyword-documentation-topic-link-abap-cloud', 'ABAPSELECT'],
    ['read-keyword-documentation-topic-link-s4-2025', 'ABAPSELECT'],
  ])("%s: the version choices name the page's own topic", (page, topic) => {
    const read = docuPage(answerFor(page));
    expect(read?.versions.map((choice) => choice.label)).toEqual([
      'Standard ABAP',
      'ABAP Cloud',
    ]);
    expect(read?.versions.map((choice) => choice.version)).toEqual(['X', '5']);
    for (const choice of read?.versions ?? []) {
      expect(choice.object).toBe(topic);
    }
  });
});

describe('docuPage edges', () => {
  it('keeps an empty href, an in-page anchor and a relative href', () => {
    const read = readDocuPage(
      '<html><body><a href="">e</a><a href="#x">a</a><a href="../r?p=1">r</a><a name="n">no href</a></body></html>',
    );
    expect(read?.links).toEqual([
      { kind: 'other', href: '', label: 'e' },
      { kind: 'other', href: '#x', label: 'a' },
      { kind: 'other', href: '../r?p=1', label: 'r' },
    ]);
  });

  it('reads a topic link: object, version absent or empty, language', () => {
    expect(
      docuLink(
        'adtcom:/sap/bc/adt/docu/abap/langu?sap-language=EN&version=&style=&object=ABAPX',
        'x',
      ),
    ).toEqual({
      kind: 'topic',
      href: 'adtcom:/sap/bc/adt/docu/abap/langu?sap-language=EN&version=&style=&object=ABAPX',
      object: 'ABAPX',
      version: '',
      language: 'EN',
      label: 'x',
    });
    expect(docuLink('/sap/bc/adt/docu/abap/langu?object=A%2FB', '')).toEqual({
      kind: 'topic',
      href: '/sap/bc/adt/docu/abap/langu?object=A%2FB',
      object: 'A/B',
      version: null,
      language: null,
      label: '',
    });
    // Without `object` it is another link.
    expect(docuLink('adtcom:/sap/bc/adt/docu/abap/langu?query=q', 'q')).toEqual(
      {
        kind: 'other',
        href: 'adtcom:/sap/bc/adt/docu/abap/langu?query=q',
        label: 'q',
      },
    );
  });

  it('reads a page cut mid-tag up to its last complete token', () => {
    const read = readDocuPage(
      '<html><head><title>T</title></head><body><a href="#a">one</a> text <a hre',
    );
    expect(read?.title).toBe('T');
    expect(read?.text).toBe('one text');
    expect(read?.links).toEqual([{ kind: 'other', href: '#a', label: 'one' }]);
    expect(read?.versions).toEqual([]);
  });

  it('reads version choices from option values that are topic links only', () => {
    const read = readDocuPage(
      '<html><body><select><option value="">Select Version</option><option value="adtcom:/sap/bc/adt/docu/abap/langu?object=T&version=X">Standard ABAP</option><option value="x">other</option></select></body></html>',
    );
    expect(read?.versions).toEqual([
      {
        kind: 'topic',
        href: 'adtcom:/sap/bc/adt/docu/abap/langu?object=T&version=X',
        object: 'T',
        version: 'X',
        language: null,
        label: 'Standard ABAP',
      },
    ]);
  });

  it('answers undefined for a body with no html element', () => {
    expect(docuPage(wire('<?xml version="1.0"?><exc:exception/>'))).toBe(
      undefined,
    );
    expect(docuPage(wire(''))).toBe(undefined);
  });

  it("answers '' for a page with no title, and skips style, script and svg text", () => {
    const read = readDocuPage(
      '<html><head><style>a<b{}</style><script>if (a<b) x()</script></head><body>x<svg><text>s</text></svg>y &rarr; &copy; &unknown;</body></html>',
    );
    expect(read?.title).toBe('');
    expect(read?.text).toBe('xy → © &unknown;');
  });

  it('collapses whitespace runs, U+00A0 included', () => {
    expect(collapsed('  a  \n b  ')).toBe('a b');
  });
});
