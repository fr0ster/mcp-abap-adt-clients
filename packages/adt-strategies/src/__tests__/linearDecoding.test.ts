import { decodeXmlText } from '../parsed';
import { decodeHtml } from '../results/gatewayHtml';

/**
 * Both reference decoders read a text once (0.28.0): a megabyte of `& `
 * with one `;` at the end, which a decoder looking for the next `;` from
 * every `&` reads once per `&`, is decoded well inside a generous bound.
 */
const HOSTILE = `${'& '.repeat(512 * 1024)};`;
const BOUND_MS = 2000;

describe.each([
  ['decodeXmlText', decodeXmlText],
  ['decodeHtml', decodeHtml],
])('%s', (_name, decode) => {
  it('decodes a megabyte of "& " and one ";" in one pass', () => {
    const started = Date.now();
    const decoded = decode(HOSTILE);
    expect(Date.now() - started).toBeLessThan(BOUND_MS);
    expect(decoded).toBe(HOSTILE);
  });

  it('still decodes what it names', () => {
    expect(decode('a &amp; b &#x26; c &#38;&lt;')).toBe('a & b & c &<');
    expect(decode('&amp;#x26;')).toBe('&#x26;');
  });
});
