import { aunitRunUri, aunitRunUriHasRunId, quotedUri } from '../scan';
import { differences, inputSets } from './differential';

/** The regexes these scanners replaced (#304), as they were. */
const AUNIT_RUN_URI = /<aunit:run[^>]*uri="([^"]+)"/;
const ANY_URI = /uri="([^"]+)"/;
const AUNIT_RUN_RUNS = /<aunit:run[^>]*uri="[^"]*\/runs\/[^/"]+/;

const sets = inputSets({
  edges: [
    '',
    '<aunit:run uri="/runs/1"/>',
    '<aunit:run uri=""/><run uri="/runs/2"/>',
    '<aunit:run a="1" uri="/x" uri="/runs/3">',
    '<aunit:run uri="/a" uri="">',
    '<aunit:run uri="/a>b"',
    '<aunit:run>uri="/x"',
    '<aunit:run uri="/x',
    '<aunit:run <aunit:run uri="/y">',
    '<aunit:run\r\nuri="/runs/4"\r\n/>',
    '<AUNIT:RUN uri="/runs/5"/>',
    '<aunit:run uri="/runs/"/>',
    '<aunit:run uri="/runs//x"/>',
    '<aunit:run uri="/runs/x"/runs/>',
  ],
  alphabet: ['<', '>', '"', '/', 'u', 'r', 'i', '=', 'x'],
  maxLength: 7,
  tokens: [
    '<aunit:run',
    'uri="',
    '/runs/',
    '"',
    '>',
    '/',
    'x',
    ' ',
    '\n',
    'u',
    '=',
  ],
});

describe('the aunit:run uri scanners answer what their regexes answered', () => {
  for (const [name, inputs] of Object.entries(sets)) {
    it(`<aunit:run[^>]*uri="([^"]+)" on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => AUNIT_RUN_URI.exec(s)?.[1], aunitRunUri),
      ).toEqual([]);
    });
    it(`uri="([^"]+)" on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => ANY_URI.exec(s)?.[1], quotedUri),
      ).toEqual([]);
    });
    it(`<aunit:run[^>]*uri="[^"]*/runs/[^/"]+ on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => AUNIT_RUN_RUNS.test(s),
          aunitRunUriHasRunId,
        ),
      ).toEqual([]);
    });
  }
});
