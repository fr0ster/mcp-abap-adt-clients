/**
 * The document scanner the shipped patches edit SAP's documents with.
 *
 * It locates an element by its path from the root — every step a direct
 * child — and hands back the byte ranges of its start tag, its content and
 * each attribute's value. Edits are splices: every byte outside them comes
 * back as it was read.
 */
import {
  applySplices,
  childAt,
  escapeAttribute,
  escapeText,
  scanDocument,
} from '../../../utils/documentEdit';

const EDGES =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<!-- <c><d>commented</d></c> -->' +
  `<r a="1" b='x>y' c = "z">` +
  '<?pi <c/> ?>' +
  '<![CDATA[<c><d>cdata</d></c>]]>' +
  '<c><d>t</d></c>' +
  '<e/>' +
  '<f  />' +
  '</r>';

function rootOf(text: string) {
  const root = scanDocument(text);
  if (root === undefined) throw new Error('fixture is not a document');
  return root;
}

describe('scanDocument / childAt', () => {
  it('finds the root past the declaration and a comment', () => {
    const root = rootOf(EDGES);
    expect(root.name).toBe('r');
    expect(EDGES.slice(root.startTag.start, root.startTag.end)).toBe(
      `<r a="1" b='x>y' c = "z">`,
    );
  });

  it('reads each attribute value range with its own quote', () => {
    const root = rootOf(EDGES);
    const values = root.attributes.map((attribute) => [
      attribute.name,
      EDGES.slice(attribute.value.start, attribute.value.end),
      attribute.quote,
    ]);
    expect(values).toEqual([
      ['a', '1', '"'],
      ['b', 'x>y', "'"],
      ['c', 'z', '"'],
    ]);
  });

  it('ends a start tag at its own `>`, not at one inside a quoted value', () => {
    const root = rootOf(EDGES);
    const d = childAt(root, ['c', 'd']);
    expect(d).toBeDefined();
    expect(EDGES.slice(d?.content?.start, d?.content?.end)).toBe('t');
  });

  it('takes no element from a comment, a processing instruction or CDATA', () => {
    const root = rootOf(EDGES);
    expect(root.children.map((child) => child.name)).toEqual(['c', 'e', 'f']);
  });

  it('reports a self-closing element with no content', () => {
    const root = rootOf(EDGES);
    const e = childAt(root, ['e']);
    expect(e?.content).toBeUndefined();
    expect(EDGES.slice(e?.startTag.start, e?.startTag.end)).toBe('<e/>');
    const f = childAt(root, ['f']);
    expect(EDGES.slice(f?.tagClose.start, f?.tagClose.end)).toBe('/>');
  });

  it('follows the path, never the first element of that name anywhere', () => {
    const text = '<r><x><y>inner</y></x><y>outer</y></r>';
    const y = childAt(rootOf(text), ['y']);
    expect(text.slice(y?.content?.start, y?.content?.end)).toBe('outer');
  });

  it('reports an absent path as absent', () => {
    const root = rootOf(EDGES);
    expect(childAt(root, ['c', 'missing'])).toBeUndefined();
    expect(childAt(root, ['d'])).toBeUndefined();
  });

  it.each([
    ['empty', ''],
    ['blank', '  \n '],
    ['not XML', 'Request failed'],
    ['cut short', '<?xml version="1.0"?><r a="1"><c>'],
    ['closed by the wrong tag', '<r><c></r></c>'],
    ['a repeated attribute', '<r a="1" a="2"/>'],
  ])('is not a document when %s', (_what, text) => {
    expect(scanDocument(text)).toBeUndefined();
  });
});

describe('applySplices', () => {
  const text = `<r  a = "1"  b='&apos;'>\n <c>&amp;</c>\n</r>`;

  it('returns every byte outside the splices as it was read', () => {
    const c = childAt(rootOf(text), ['c']);
    const content = c?.content;
    if (content === undefined) throw new Error('no content');
    const out = applySplices(text, [{ ...content, text: 'new' }]);
    expect(out).toBe(`<r  a = "1"  b='&apos;'>\n <c>new</c>\n</r>`);
  });

  it('applies several splices whatever order they come in', () => {
    const root = rootOf(text);
    const a = root.attributes[0]?.value;
    const content = childAt(root, ['c'])?.content;
    if (a === undefined || content === undefined) throw new Error('fixture');
    const splices = [
      { ...a, text: '2' },
      { ...content, text: 'x' },
    ];
    const expected = `<r  a = "2"  b='&apos;'>\n <c>x</c>\n</r>`;
    expect(applySplices(text, splices)).toBe(expected);
    expect(applySplices(text, [...splices].reverse())).toBe(expected);
  });

  it('keeps insertions at one point in the order given', () => {
    const out = applySplices('<r/>', [
      { start: 2, end: 2, text: ' a="1"' },
      { start: 2, end: 2, text: ' b="2"' },
    ]);
    expect(out).toBe('<r a="1" b="2"/>');
  });
});

describe('escaping', () => {
  it('escapes text: &, < and >', () => {
    expect(escapeText(`a&b<c>d"e'f`)).toBe(`a&amp;b&lt;c&gt;d"e'f`);
  });

  it('escapes an attribute value by its own quote character', () => {
    expect(escapeAttribute(`a&b<c>d"e'f`, '"')).toBe(
      `a&amp;b&lt;c&gt;d&quot;e'f`,
    );
    expect(escapeAttribute(`a&b<c>d"e'f`, "'")).toBe(
      `a&amp;b&lt;c&gt;d"e&apos;f`,
    );
  });
});
