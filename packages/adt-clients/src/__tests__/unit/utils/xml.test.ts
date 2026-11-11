/**
 * The one escaping every XML body this library writes goes through. Each
 * character is pinned here; that a value reads back as given through a
 * conforming parser is shown in `core/createWhiteSpace.test.ts` and
 * `core/shared/documentPatch.test.ts`.
 */
import { escapeXmlAttr, escapeXmlText } from '../../../utils/xml';

describe('escapeXmlAttr', () => {
  it('escapes all five XML attribute metacharacters', () => {
    expect(escapeXmlAttr(`a&b<c>d"e'f`)).toBe(
      'a&amp;b&lt;c&gt;d&quot;e&apos;f',
    );
  });

  it('writes LF, tab and CR as references, which a parser would read as spaces', () => {
    expect(escapeXmlAttr('a\nb\tc\rd\r\ne')).toBe(
      'a&#10;b&#9;c&#13;d&#13;&#10;e',
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeXmlAttr('ZOK_TEST_FUNC')).toBe('ZOK_TEST_FUNC');
  });
});

describe('escapeXmlText', () => {
  it('escapes &, < and >, and leaves the quotes', () => {
    expect(escapeXmlText(`a&b<c>d"e'f`)).toBe(`a&amp;b&lt;c&gt;d"e'f`);
  });

  it('writes CR as a reference, which a parser would read as LF; LF and tab as they are', () => {
    expect(escapeXmlText('a\rb\r\nc\td\ne')).toBe('a&#13;b&#13;\nc\td\ne');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeXmlText('ZOK_TEST_FUNC')).toBe('ZOK_TEST_FUNC');
  });
});
