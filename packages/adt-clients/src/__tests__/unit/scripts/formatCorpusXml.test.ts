import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatCorpusXml } from '../../../../scripts/lib/formatCorpusXml';

/**
 * The corpus keeps its XML bodies formatted (`npm run corpus:format`), and
 * formatting changes layout only.
 */
const CORPUS = join(__dirname, '../../../../corpus/adt');

const bodies = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? bodies(join(dir, entry.name))
      : entry.name.endsWith('.body.xml')
        ? [join(dir, entry.name)]
        : [],
  );

describe('formatCorpusXml', () => {
  it('puts one element on a line, indented, and keeps a leaf on its line', () => {
    expect(
      formatCorpusXml('<?xml version="1.0"?><a x="1"><b>t</b><c/></a>'),
    ).toBe('<?xml version="1.0"?>\n<a x="1">\n  <b>t</b>\n  <c/>\n</a>\n');
  });

  it.each([
    [
      'a value of spaces',
      '<a><VALUE>       </VALUE></a>',
      '<VALUE>       </VALUE>',
    ],
    ['an empty element as written', '<a><b></b><c/></a>', '<b></b>'],
    ['an apostrophe in an attribute', `<a t="it's"/>`, `t="it's"`],
    ['an entity', '<a>x &gt; y &amp; z</a>', 'x &gt; y &amp; z'],
    ['a text with padding', '<a>\n\ntext\n\n</a>', '\n\ntext\n\n'],
    ['mixed content', '<a>one<b>two</b>three</a>', 'one<b>two</b>three'],
    [
      'mixed content opening with a child',
      '<r><a><b/>text</a></r>',
      '<a><b/>text</a>',
    ],
    [
      'a CDATA section',
      '<r><VALUE><![CDATA[abc]]></VALUE></r>',
      '<VALUE><![CDATA[abc]]></VALUE>',
    ],
  ])('keeps %s', (_what, input, kept) => {
    expect(formatCorpusXml(input)).toContain(kept);
  });

  it('reads a > inside a quoted attribute as part of the tag', () => {
    expect(formatCorpusXml('<a><b t=">"/><c/></a>')).toBe(
      '<a>\n  <b t=">"/>\n  <c/>\n</a>\n',
    );
  });

  it('reads a processing instruction to its ?>', () => {
    expect(formatCorpusXml('<?pi x > <b/> ?><a/>')).toBe(
      '<?pi x > <b/> ?>\n<a/>\n',
    );
  });

  it('changes nothing in a formatted body', () => {
    const once = formatCorpusXml('<a><b>t</b><c><d/></c></a>');
    expect(formatCorpusXml(once)).toBe(once);
  });

  it('finds every recorded XML body formatted already', () => {
    const files = bodies(CORPUS);
    expect(files.length).toBeGreaterThan(0);
    const unformatted = files.filter((file) => {
      const text = readFileSync(file, 'utf-8');
      return formatCorpusXml(text) !== text;
    });
    expect(unformatted).toEqual([]);
  });
});
