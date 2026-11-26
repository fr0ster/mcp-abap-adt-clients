import { withoutTrailingSlashes } from '../scan';
import { differences, inputSets } from './differential';

/** The regex `withoutTrailingSlashes` replaced (#304), as it was. */
const TRAILING = /\/+$/;

const sets = inputSets({
  edges: ['', '/', '//', 'a/', 'a//', '/a', 'a/\n', 'a/b/', '\\/'],
  alphabet: ['/', 'a', '\n', '\\'],
  maxLength: 8,
  tokens: ['/', '//', 'a', '\n', ' ', '\\'],
});

describe('withoutTrailingSlashes answers what replace(/\\/+$/, "") answered', () => {
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => s.replace(TRAILING, ''),
          withoutTrailingSlashes,
        ),
      ).toEqual([]);
    });
});
