import { leapSecondParts, subMilliDigits, traceIdIn } from '../scan';
import { differences, inputSets } from './differential';

/** The regexes these scanners replaced (#304), as they were. */
const ID_IN_URI = /abaptraces\/([A-Za-z0-9]{16,})(?:\/|$)/;
const SUB_MILLI = /\.(\d+)/;
const LEAP_SECOND = /^(.*T\d{2}:\d{2}:)60(\D.*)?$/;

const ID16 = 'ABCDEF0123456789';
// The neighbours of each range ('/', ':', '@', '[', '`', '{') catch an
// off-by-one bound.
const RANGE_EDGES = [
  '0',
  '9',
  'A',
  'Z',
  'a',
  'z',
  '/',
  ':',
  '@',
  '[',
  '`',
  '{',
];

describe('traceIdIn answers what ID_IN_URI answered', () => {
  const sets = inputSets({
    edges: [
      '',
      `/sap/bc/adt/runtime/traces/abaptraces/${ID16}`,
      `abaptraces/${ID16}/`,
      `abaptraces/${ID16}x/`,
      `abaptraces/${ID16.slice(1)}`,
      `abaptraces/${ID16}-`,
      `abaptraces/${ID16}?a`,
      `abaptraces/short/abaptraces/${ID16}`,
      `ABAPTRACES/${ID16}`,
      `abaptraces/${ID16}\n`,
    ],
    alphabet: [
      'abaptraces/',
      ID16,
      ID16.slice(1),
      ...RANGE_EDGES.slice(0, 4),
      '/',
      '-',
    ],
    maxLength: 4,
    tokens: ['abaptraces/', ID16, 'ABCD', ...RANGE_EDGES, '-', '\n', '?'],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => ID_IN_URI.exec(s)?.[1], traceIdIn),
      ).toEqual([]);
    });
  it('on every range neighbour', () => {
    const inputs = RANGE_EDGES.flatMap((c) => [
      `abaptraces/${ID16}${c}`,
      `abaptraces/${c}${ID16}`,
      `abaptraces/${c.repeat(16)}`,
    ]);
    expect(
      differences(inputs, (s) => ID_IN_URI.exec(s)?.[1], traceIdIn),
    ).toEqual([]);
  });
});

describe('subMilliDigits answers what SUB_MILLI answered', () => {
  const sets = inputSets({
    edges: [
      '',
      '2026-08-28T10:00:00.1001Z',
      '2026-08-28T10:00:00Z',
      '..1',
      '.a.12',
      '.١',
      '10.5.3',
    ],
    alphabet: ['.', '0', '9', '/', ':', 'a', '\n'],
    maxLength: 7,
    tokens: ['.', '0', '9', '/', ':', 'a', '\n', '12', 'T'],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => SUB_MILLI.exec(s)?.[1], subMilliDigits),
      ).toEqual([]);
    });
});

describe('leapSecondParts answers what LEAP_SECOND answered', () => {
  const oracle = (s: string) => {
    const m = LEAP_SECOND.exec(s);
    return m ? { head: m[1], tail: m[2] } : undefined;
  };
  const sets = inputSets({
    edges: [
      '',
      '2016-12-31T23:59:60Z',
      '2016-12-31T23:59:60',
      '2016-12-31T23:59:60.5Z',
      '2016-12-31T23:59:601',
      '2016-12-31T23:59:60\nZ',
      '2016-12-31T23:59:60Z\n',
      '\n2016-12-31T23:59:60Z',
      'T23:59:60T00:00:60Z',
      'T23:59:60ZT00:00:60',
      'T2:59:60',
      'T23:5:60',
      'T23:59:59',
      'T23:59:60 ',
      'T23:59:60 x',
      'T23:59:60x ',
      't23:59:60Z',
    ],
    alphabet: [
      'T00:00:60',
      'T00:00:',
      'T',
      '60',
      '0',
      ':',
      'Z',
      '\n',
      '\r',
      '/',
    ],
    maxLength: 4,
    tokens: [
      'T23:59:60',
      'T',
      '23',
      ':',
      '60',
      '6',
      '0',
      '5',
      'Z',
      '.',
      '\n',
      '\r',
      ' ',
      ' ',
      '/',
    ],
  });
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(differences(inputs(), oracle, leapSecondParts)).toEqual([]);
    });
});
