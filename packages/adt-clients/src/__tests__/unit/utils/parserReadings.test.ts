/**
 * Y of #304: the parser sites bind the parser's `any` to `unknown` and read
 * it through the typed readers. Each reading gives, for every recorded body
 * and a set of fixtures, what it gave before; the snapshot was written by the
 * code before the change.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { readListenerConflict } from '../../../runtime/debugger/abap';
import { sapErrorIn } from '../../../utils/adtErrors';
import { lockHandleOf } from '../../../utils/lockHandle';
import { getSystemInformation } from '../../../utils/systemInfo';

const CORPUS = join(__dirname, '../../../../corpus/adt');
const bodies: [string, string][] = ['answers', 'debugger'].flatMap((folder) =>
  readdirSync(join(CORPUS, folder))
    .filter((f) => f.includes('.body.'))
    .sort()
    .map((f): [string, string] => [
      `${folder}/${f}`,
      readFileSync(join(CORPUS, folder, f), 'utf-8'),
    ]),
);

const FIXTURES: [string, string][] = [
  ['empty', ''],
  ['not xml', 'plain text <'],
  [
    'an exception with text elements',
    '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="T"/><namespace id="N"/><localizedMessage lang="EN">said</localizedMessage></exc:exception>',
  ],
  [
    'an exception with message only',
    '<exc:exception xmlns:exc="x"><message>m</message></exc:exception>',
  ],
  ['an exception, text root', '<exc:exception xmlns:exc="x">t</exc:exception>'],
  [
    'a conflict, one entry',
    '<exc:exception xmlns:exc="x"><properties><entry key="conflictText">held</entry></properties></exc:exception>',
  ],
  [
    'a conflict, two entries',
    '<exc:exception xmlns:exc="x"><properties><entry key="conflictText">held</entry><entry key="ideUser">U</entry></properties></exc:exception>',
  ],
  [
    'a conflict, an entry with an element',
    '<exc:exception xmlns:exc="x"><properties><entry key="conflictText"><b>x</b></entry></properties></exc:exception>',
  ],
  [
    'a lock result',
    '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
  ],
  [
    'a lock result, no handle',
    '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA/></asx:values></asx:abap>',
  ],
  ['system information', '{"systemID":"ABC","client":"100","userName":"U"}'],
  ['system information, an array', '[1,2]'],
  ['system information, a string', '"text"'],
  ['system information, broken', '{"a":'],
];
const INPUTS = [...bodies, ...FIXTURES];

const wire = (data: string, status = 200): IAdtWireResponse => ({
  status,
  statusText: '',
  headers: {},
  data,
});

describe('the parser readings answer as before', () => {
  it('sapErrorIn', () => {
    const table = Object.fromEntries(
      INPUTS.map(([name, body]) => {
        const error = sapErrorIn(body);
        return [
          name,
          error && {
            message: error.message,
            adtType: error.adtType,
            namespace: error.namespace,
          },
        ];
      }),
    );
    expect(table).toMatchSnapshot();
  });

  it('readListenerConflict', () => {
    const table = Object.fromEntries(
      INPUTS.map(([name, body]) => [
        name,
        readListenerConflict({
          origin: 'connection',
          message: 'm',
          response: wire(body, 409),
        }),
      ]),
    );
    expect(table).toMatchSnapshot();
  });

  it('lockHandleOf', () => {
    const table = Object.fromEntries(
      INPUTS.map(([name, body]) => [name, lockHandleOf(wire(body))]),
    );
    expect(table).toMatchSnapshot();
  });

  it('getSystemInformation', async () => {
    const table: Record<string, unknown> = {};
    for (const [name, body] of INPUTS) {
      const connection = {
        makeAdtRequest: async () => wire(body),
        getBaseUrl: async () => 'https://example.test',
        getSessionId: () => null,
        setSessionType: () => undefined,
        connect: async () => undefined,
      };
      const answer = await getSystemInformation(connection);
      table[name] = answer.ok
        ? answer.getResult().value
        : answer.getError().message;
    }
    expect(table).toMatchSnapshot();
  });
});
