import { runIdAfter } from '../scan';
import { differences, inputSets } from './differential';

/** The regexes `runIdAfter` replaced (#304), as they were. */
const RUNS = /\/runs\/([^/]+)/;
const ACTIVATION_RUNS = /\/activation\/runs\/([^/]+)/;

const sets = inputSets({
  edges: [
    '',
    '/runs/',
    '/runs//x',
    '/runs/a',
    '/runs/a/b',
    '/RUNS/a',
    'x/runs/\r\nid',
    '/runs//runs/id',
    '/activation/runs/',
    '/activation/runs/id?x=1',
    '/sap/bc/adt/abapunit/runs/fa53c505dd7b1fd1abb859f1193d5d44',
    '/activation/activation/runs/7',
  ],
  alphabet: ['/', 'r', 'u', 'n', 's', 'a', 'x', '\n'],
  maxLength: 8,
  tokens: [
    '/',
    'r',
    'u',
    'n',
    's',
    'x',
    '"',
    '/runs/',
    '/activation',
    '\n',
    '?',
  ],
});

describe('runIdAfter answers what /\\/runs\\/([^/]+)/ answered', () => {
  for (const [name, inputs] of Object.entries(sets)) {
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => RUNS.exec(s)?.[1],
          (s) => runIdAfter(s, '/runs/'),
        ),
      ).toEqual([]);
    });
    it(`on the ${name} inputs, after /activation/runs/`, () => {
      expect(
        differences(
          inputs(),
          (s) => ACTIVATION_RUNS.exec(s)?.[1],
          (s) => runIdAfter(s, '/activation/runs/'),
        ),
      ).toEqual([]);
    });
  }
});
