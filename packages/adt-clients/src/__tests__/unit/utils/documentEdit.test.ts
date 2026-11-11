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
    ['it has two roots', '<a/><r/>'],
    ['an element follows the root', '<r><c/></r>\n<other/>'],
    ['an element follows a self-closing root', '<r/><other/>'],
    ['text precedes the root', 'x<r/>'],
    ['text follows the root', '<r/>x'],
    ['CDATA precedes the root', '<![CDATA[x]]><r/>'],
    ['CDATA follows the root', '<r/><![CDATA[x]]>'],
    ['a DOCTYPE follows the root', '<r/><!DOCTYPE r>'],
    ['a DOCTYPE precedes the root', '<!DOCTYPE r><r/>'],
    [
      'a DOCTYPE follows the declaration',
      '<?xml version="1.0"?>\n<!DOCTYPE r>\n<r/>',
    ],
    [
      'a DOCTYPE with an internal subset precedes the root',
      '<!DOCTYPE r [<!ELEMENT r ANY>]><r/>',
    ],
    ['a DOCTYPE stands inside the root', '<r><!DOCTYPE r></r>'],
    ['a markup declaration stands inside the root', '<r><!ELEMENT r ANY></r>'],
    ['text holds a bare &', '<r>a & b</r>'],
    ['text holds an & with no ;', '<r>&amp</r>'],
    ['text holds an undefined entity', '<r>&foo;</r>'],
    ['text holds an empty reference', '<r>&;</r>'],
    ['text holds a hex reference with no digit', '<r>&#x;</r>'],
    ['text holds a hex reference with a non-hex digit', '<r>&#xZZ;</r>'],
    ['text holds a decimal reference with a letter', '<r>&#1a;</r>'],
    ['text holds an upper-case X reference', '<r>&#X41;</r>'],
    ['text references NUL', '<r>&#0;</r>'],
    ['text references a surrogate', '<r>&#xD800;</r>'],
    ['text references U+FFFE', '<r>&#xFFFE;</r>'],
    ['text references past U+10FFFF', '<r>&#x110000;</r>'],
    ['text holds ]]>', '<r>a]]>b</r>'],
    ['an attribute holds a bare &', '<r a="a & b"/>'],
    ['an attribute holds an undefined entity', '<r a="&foo;"/>'],
    ['an attribute holds a bad hex reference', '<r a="&#xZZ;"/>'],
    ['an attribute references NUL', "<r a='&#0;'/>"],
    ['an attribute holds a decimal reference with a letter', '<r a="&#6a;"/>'],
    ['an attribute holds an upper-case X reference', '<r a="&#X41;"/>'],
    ['an attribute holds <', '<r a="a<b"/>'],
    ['a nested attribute holds a bare &', '<r><c a="&"/></r>'],
    ['it declares its own entity', '<!DOCTYPE r [<!ENTITY e "x">]><r>&e;</r>'],
    ['text holds a literal NUL', '<r>a\u0000b</r>'],
    ['CDATA holds a literal NUL', '<r><![CDATA[a\u0000b]]></r>'],
    ['an attribute holds U+0001', '<r a="\u0001"/>'],
    ['a comment holds U+0001', '<r><!-- \u0001 --></r>'],
    ['a processing instruction holds U+0001', '<r><?pi \u0001?></r>'],
    ['a comment before the root holds U+0001', '<!-- \u0001 --><r/>'],
    ['text holds U+FFFE', '<r>\ufffe</r>'],
    ['text holds U+FFFF', '<r>\uffff</r>'],
    ['text holds a lone high surrogate', '<r>a\ud800b</r>'],
    ['text ends in a lone high surrogate', '<r>\ud800</r>'],
    ['text holds a lone low surrogate', '<r>a\udc00b</r>'],
    ['an attribute holds a lone low surrogate', '<r a="\udfff"/>'],
    ['a comment holds --', '<r><!-- a--b --></r>'],
    ['a comment ends in --->', '<r><!-- a ---></r>'],
    ['a comment before the root holds --', '<!-- a--b --><r/>'],
    ['a BOM stands after the declaration', '<?xml version="1.0"?>\ufeff<r/>'],
    ['a BOM follows the root', '<r/>\ufeff'],
    ['a document is a BOM alone', '\ufeff'],
  ])('is not a document when %s', (_what, text) => {
    expect(scanDocument(text)).toBeUndefined();
  });

  it('accepts the predefined entities and well-formed character references', () => {
    const references =
      '&amp;&lt;&gt;&quot;&apos;&#10;&#9;&#13;&#65;&#0065;&#x41;&#xe9;&#x1F600;&#x10FFFF;';
    const text = `<r a="${references}" b='${references}'>${references}<c d="&amp;"/>&amp;</r>`;
    expect(rootOf(text).name).toBe('r');
  });

  it('accepts every XML Char, the astral ones as surrogate pairs', () => {
    const chars =
      'tab\tLF\nCR\r \u007f\u0080\ud7ff\ue000\ufeff\ufffd\ud800\udc00\ud83d\ude00\udbff\udfff';
    const text = `<r a="${chars}"><!-- ${chars} --><?pi ${chars}?><![CDATA[${chars}]]>${chars}</r>`;
    expect(rootOf(text).name).toBe('r');
  });

  it('accepts a comment with single hyphens and an empty one', () => {
    expect(rootOf('<!-- a-b - c --><r><!----><!---a-b-c-->x</r>').name).toBe(
      'r',
    );
  });

  it('accepts a leading BOM and places the elements after it', () => {
    const text = '\ufeff<?xml version="1.0"?><r a="1"><c/></r>';
    const root = rootOf(text);
    expect(root.name).toBe('r');
    expect(root.startTag.start).toBe(text.indexOf('<r'));
    expect(text.slice(root.startTag.start, root.startTag.end)).toBe(
      '<r a="1">',
    );
    expect(rootOf('\ufeff<r/>').startTag.start).toBe(1);
  });

  it('allows comments, processing instructions and white space around the root', () => {
    const text =
      '<?xml version="1.0"?>\n<!-- before -->\n<?pi a?>\n' +
      '<r><c/></r>\n<!-- after -->\n<?pi b?>\n';
    expect(rootOf(text).name).toBe('r');
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
