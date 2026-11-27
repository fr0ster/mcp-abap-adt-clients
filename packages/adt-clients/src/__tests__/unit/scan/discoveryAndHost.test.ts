import { hrefValues, namesHanaOnDemand } from '../../../utils/scan';
import { differences, inputSets } from '../../helpers/differential';

/** The regexes (#304), as they were. */
const HREF = /href="([^"]+)"/g;
const HANA = /\.hana\.ondemand\.com/i;
const hrefOracle = (text: string) => {
  const found: string[] = [];
  const re = new RegExp(HREF.source, 'g');
  let match = re.exec(text);
  while (match !== null) {
    found.push(match[1] ?? '');
    match = re.exec(text);
  }
  return found;
};

describe('hrefValues answers what the href exec loop answered', () => {
  const sets = inputSets({
    edges: [
      '',
      '<app:collection href="/sap/bc/adt/x"/>',
      'href=""href="/a"',
      'xhref="/b"',
      'href="/c',
      'href="href="/d""',
      'href=""',
      'HREF="/e"',
    ],
    alphabet: ['href="', '"', '/', 'x'],
    maxLength: 6,
    tokens: ['href="', 'xhref="', '"', '/', 'a', ' ', '>', 'href='],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(differences(inputs(), hrefOracle, hrefValues)).toEqual([]);
    });
});

describe('namesHanaOnDemand answers what the host regex answered', () => {
  const sets = inputSets({
    edges: [
      '',
      'https://abc.abap.eu10.hana.ondemand.com',
      'https://X.HANA.ONDEMAND.COM',
      'https://hana.ondemand.com',
      'https://x.hana.ondemand.co',
      'https://x.hanaİondemand.com',
      'https://x.hana.ondemand.com.evil',
      'https://x.hanaxondemand.com',
    ],
    alphabet: ['.hana', '.ondemand', '.com', '.', 'x', 'HANA'],
    maxLength: 5,
    tokens: [
      '.hana',
      '.HANA',
      '.ondemand',
      '.ONDEMAND',
      '.com',
      '.co',
      '.',
      'm',
      'ſ',
      'K',
    ],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => HANA.test(s), namesHanaOnDemand),
      ).toEqual([]);
    });
  it('folds every BMP letter as the regex does', () => {
    const differing: string[] = [];
    for (let code = 0; code < 0x10000; code++) {
      const input = `x.h${String.fromCharCode(code)}na.ondemand.com`;
      if (HANA.test(input) !== namesHanaOnDemand(input))
        differing.push(code.toString(16));
    }
    expect(differing).toEqual([]);
  });
});
