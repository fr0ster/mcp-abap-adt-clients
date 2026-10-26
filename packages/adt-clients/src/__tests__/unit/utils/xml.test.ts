import { escapeXmlAttr } from '../../../utils/xml';

describe('escapeXmlAttr', () => {
  it('escapes all five XML attribute metacharacters', () => {
    expect(escapeXmlAttr(`a&b<c>d"e'f`)).toBe(
      'a&amp;b&lt;c&gt;d&quot;e&apos;f',
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeXmlAttr('ZOK_TEST_FUNC')).toBe('ZOK_TEST_FUNC');
  });
});
