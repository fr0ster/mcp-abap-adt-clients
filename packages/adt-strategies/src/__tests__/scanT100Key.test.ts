import { isT100ValueKey } from '../scan';
import { differences, inputSets } from './differential';

/** The regex `isT100ValueKey` replaced (#304), as it was. */
const T100_VALUE_KEY = /^T100KEY-V\d+$/;

const sets = inputSets({
  edges: [
    '',
    'T100KEY-V',
    'T100KEY-V1',
    'T100KEY-V12',
    'T100KEY-V1\n',
    'T100KEY-V1a',
    't100key-v1',
    'xT100KEY-V1',
    'T100KEY-V١',
    'T100KEY-ID',
    'T100KEY-NO',
  ],
  // The neighbours of the digits, '/' and ':', catch an off-by-one range.
  alphabet: ['T100KEY-V', 'T', 'V', '1', '0', '9', '/', ':', '\n'],
  maxLength: 5,
  tokens: ['T100KEY-V', 'T100KEY-', 'V', '1', '0', '9', 'a', '\n', ' ', '١'],
});

describe('isT100ValueKey answers what /^T100KEY-V\\d+$/ answered', () => {
  for (const [name, inputs] of Object.entries(sets))
    it(`on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => T100_VALUE_KEY.test(s), isT100ValueKey),
      ).toEqual([]);
    });
});
