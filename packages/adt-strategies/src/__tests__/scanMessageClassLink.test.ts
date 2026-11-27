import { messageClassKey, unescapedAmpersands } from '../scan';
import { differences, inputSets } from './differential';

/** The regexes these scanners replaced (#304), as they were. */
const MESSAGE_CLASS = /\/messageclass\/([^/]+)\/messages\/([^/?]+)/i;
const AMP = /&amp;/g;

const sets = inputSets({
  edges: [
    '',
    '/messageclass/SWB_TOOL/messages/029/longtext?language=E&amp;msgv1=X',
    '/sap/bc/adt/messageclass/SWB_TOOL/messages/029',
    '/MESSAGECLASS/A/MESSAGES/1',
    '/messageclass//messages/1',
    '/messageclass/A/messages/',
    '/messageclass/A/messages/?x',
    '/messageclass/A/B/messages/1',
    '/messageclass/A/messages/1/messageclass/B/messages/2',
    '/messageclass/x/messageclass/A/messages/7',
    '/meſſageclass/A/meſſages/1',
    '/messageclass/A%2FB/messages/0%31',
    '&amp;&amp;amp;&amp',
  ],
  // `ſ` upper-cases to ASCII `S`, which the regex's /i folding refuses.
  alphabet: [
    '/messageclass/',
    '/MessageClass/',
    '/messages/',
    '/MESSAGES/',
    '/meſſages/',
    '/',
    '?',
    'x',
  ],
  maxLength: 5,
  tokens: [
    '/messageclass/',
    '/MESSAGECLASS/',
    '/messages/',
    '/Messages/',
    '/meſſageclass/',
    '/',
    '?',
    'x',
    '&amp;',
    '&',
    'amp;',
    '\n',
  ],
});

describe('the long-text link scanners answer what their regexes answered', () => {
  for (const [name, inputs] of Object.entries(sets)) {
    it(`the message class key on the ${name} inputs`, () => {
      expect(
        differences(
          inputs(),
          (s) => {
            const key = MESSAGE_CLASS.exec(s);
            return key ? { id: key[1], no: key[2] } : undefined;
          },
          messageClassKey,
        ),
      ).toEqual([]);
    });
    it(`&amp; on the ${name} inputs`, () => {
      expect(
        differences(inputs(), (s) => s.replace(AMP, '&'), unescapedAmpersands),
      ).toEqual([]);
    });
  }
});

describe('the folding is the regex /i folding', () => {
  it('folds every BMP letter the way the regex does', () => {
    const differing: string[] = [];
    for (let code = 0; code < 0x10000; code++) {
      const c = String.fromCharCode(code);
      const input = `/me${c}sageclass/A/messages/1`;
      const expected = MESSAGE_CLASS.exec(input) !== null;
      if (expected !== (messageClassKey(input) !== undefined))
        differing.push(code.toString(16));
    }
    expect(differing).toEqual([]);
  });
});
