/**
 * K5 of #304, the table test of spec section 7: every site that read a
 * thrown value through a cast now reads it through `propertyOf`, and gives the
 * same result for each input — SAP's recorded refusals carried as an Error's
 * `response`, a `response` inherited or behind a getter, primitives and
 * `null`. The snapshot was written by the code before the change, and one
 * difference was then accepted into it: a connection rejecting with `null` or
 * `undefined` made the six create, update and read catch blocks throw a
 * `TypeError` of their own (`e.response` on `null`), which replaced the
 * rejection; now the rejection is rethrown as it came, and the table type read
 * logs it. Every other input reads exactly as before.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.DEBUG_ADT_LIBS = 'true';
// Loaded after the flag is set: the modules read it once, at load.
const { create: createClass } =
  require('../../../core/class/create') as typeof import('../../../core/class/create');
const { create: createEnhancement } =
  require('../../../core/enhancement/create') as typeof import('../../../core/enhancement/create');
const { update: updateEnhancement } =
  require('../../../core/enhancement/update') as typeof import('../../../core/enhancement/update');
const { create: createFunctionGroup } =
  require('../../../core/functionGroup/create') as typeof import('../../../core/functionGroup/create');
const { create: createInterface } =
  require('../../../core/interface/create') as typeof import('../../../core/interface/create');
const { getTableTypeMetadata } =
  require('../../../core/tabletype/read') as typeof import('../../../core/tabletype/read');
const { extractSupportedAccept, extractSupportedContentType } =
  require('../../../utils/supportedMediaTypes') as typeof import('../../../utils/supportedMediaTypes');
const { fetchDiscoveryEndpoints } =
  require('../../../utils/discoveryEndpoints') as typeof import('../../../utils/discoveryEndpoints');
const { isModernAdtSystem } =
  require('../../../utils/systemInfo') as typeof import('../../../utils/systemInfo');
const { lockClassForMessageOrPlain, lockMessageIfGranted } =
  require('../../../core/messageClass/lock') as typeof import('../../../core/messageClass/lock');
const { safeErrorMessage } =
  require('../../../utils/internalUtils') as typeof import('../../../utils/internalUtils');

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');
const recorded = readdirSync(ANSWERS)
  .filter((f) => f.startsWith('refusal-') && f.endsWith('.json'))
  .sort()
  .map((file): [string, unknown] => {
    const meta = JSON.parse(readFileSync(join(ANSWERS, file), 'utf-8')) as {
      response: {
        status: number;
        headers?: Record<string, string>;
        bodyFile?: string;
      };
    };
    const data = meta.response.bodyFile
      ? readFileSync(join(ANSWERS, meta.response.bodyFile), 'utf-8')
      : '';
    const response = {
      status: meta.response.status,
      statusText: 'Refused',
      headers: meta.response.headers ?? {},
      data,
    };
    return [file, Object.assign(new Error('Request failed'), { response })];
  });

const plainResponse = {
  status: 415,
  statusText: 'Unsupported Media Type',
  headers: { 'content-type': 'text/plain' },
  data: 'Supported Media Types: application/xml, text/plain',
};
const INPUTS: [string, unknown][] = [
  ...recorded,
  [
    'an Error with a response',
    Object.assign(new Error('e'), { response: plainResponse }),
  ],
  [
    'an inherited response',
    Object.create({ response: plainResponse, status: 403 }),
  ],
  [
    'a getter response',
    {
      get response() {
        return { ...plainResponse, status: 403 };
      },
    },
  ],
  ['a status of its own', { status: 403, message: 'own' }],
  ['a string', 'refused'],
  ['a number', 403],
  ['true', true],
  ['undefined', undefined],
  ['null', null],
];

/** What a site did: its answer or its throw, and everything it logged. */
async function outcome(input: unknown, run: (c: never, l: never) => unknown) {
  const logged: unknown[] = [];
  const logger = Object.fromEntries(
    ['debug', 'info', 'warn', 'error'].map((level) => [
      level,
      (...args: unknown[]) => logged.push([level, ...args]),
    ]),
  );
  const connection = {
    makeAdtRequest: () => Promise.reject(input),
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => null,
    setSessionType: () => undefined,
    connect: async () => undefined,
  };
  try {
    const answer = await run(connection as never, logger as never);
    return { answer: answer instanceof Set ? [...answer] : answer, logged };
  } catch (thrown) {
    return {
      thrown:
        thrown === input
          ? 'the input'
          : thrown instanceof Error
            ? `${thrown.name}: ${thrown.message}`
            : thrown,
      logged,
    };
  }
}

const SITES: [string, (c: never, l: never, input: unknown) => unknown][] = [
  [
    'class create',
    (c, l) =>
      createClass(
        c,
        {} as never,
        { class_name: 'ZCL_X', package_name: 'P' },
        l,
      ),
  ],
  [
    'enhancement create',
    (c, l) =>
      createEnhancement(
        c,
        {} as never,
        {
          enhancement_name: 'ZE',
          enhancement_type: 'enhoxhh',
          package_name: 'P',
          enhancement_spot: 'ZSPOT',
        },
        l,
      ),
  ],
  [
    'enhancement update',
    (c, l) =>
      updateEnhancement(
        c,
        {} as never,
        undefined,
        {
          enhancement_name: 'ZE',
          enhancement_type: 'enhoxhh',
          source_code: 's',
          lock_handle: 'L',
        },
        l,
      ),
  ],
  [
    'function group create',
    (c, l) =>
      createFunctionGroup(
        c,
        {} as never,
        { functionGroupName: 'ZFG', packageName: 'P', description: 'd' },
        l,
      ),
  ],
  [
    'interface create',
    (c, l) =>
      createInterface(
        c,
        {} as never,
        { interfaceName: 'ZIF', packageName: 'P', description: 'd' },
        l,
      ),
  ],
  [
    'table type metadata',
    (c, l) => getTableTypeMetadata(c, 'ZTT', undefined, l),
  ],
  ['supported accept', (_c, _l, input) => extractSupportedAccept(input)],
  [
    'supported content type',
    (_c, _l, input) => extractSupportedContentType(input),
  ],
  ['discovery endpoints', (c) => fetchDiscoveryEndpoints(c)],
  ['modern ADT system', (c) => isModernAdtSystem(c)],
  [
    'class lock for a message',
    (c) => lockClassForMessageOrPlain(c, 'ZMC', '001'),
  ],
  ['message lock if granted', (c) => lockMessageIfGranted(c, 'ZMC', '001')],
  ['safe error message', (_c, _l, input) => safeErrorMessage(input)],
];

describe('a thrown value is read as before', () => {
  for (const [site, run] of SITES)
    it(site, async () => {
      const table: Record<string, unknown> = {};
      for (const [name, input] of INPUTS)
        table[name] = await outcome(input, (c, l) => run(c, l, input));
      expect(table).toMatchSnapshot();
    });
});
