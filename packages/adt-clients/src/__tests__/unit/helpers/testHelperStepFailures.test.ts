/**
 * A failing step of `test-helper.js` says what SAP said — the status, each
 * message's T100 key and short text, the request's path — and never the
 * request's query, which carries the lock handle.
 *
 * The library classes a 500 whose body nobody read as a connection failure,
 * and its sentence alone is "Request failed with status code 500": a log line
 * built from it says nothing of why the step failed.
 */

// The headers each member sends are recorded per real handler class; this
// fake is none of them, and what it is sent is not what is under test.
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import type { IAdtFailure, IAdtSuccess } from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';

const {
  mustSucceed,
  writeAndActivate,
  writeSource,
} = require('../../helpers/test-helper');

const EXCEPTION =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceFailure"/>' +
  '<message lang="EN">Interface ZTHING could not be saved</message>' +
  '<localizedMessage lang="EN">Interface ZTHING could not be saved</localizedMessage>' +
  '<properties><entry key="T100KEY-ID">SEO_X</entry>' +
  '<entry key="T100KEY-NO">042</entry></properties></exc:exception>';
const PATH = '/sap/bc/adt/oo/interfaces/zthing';
const SAP_ANSWER = [
  'Request failed with status code 500',
  'HTTP 500',
  'SEO_X/042',
  'Interface ZTHING could not be saved',
  PATH,
];

const failedOnTheWire = (method: string, query: string): IAdtFailure => ({
  ok: false,
  getError: () => ({
    origin: 'connection',
    message: 'Request failed with status code 500',
    response: {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      data: EXCEPTION,
    },
    request: { method, url: `${PATH}?${query}` },
  }),
});
const ok = (value: unknown): IAdtSuccess<unknown> => ({
  ok: true,
  getResult: () => ({ value }),
});
const refusedUnlock = () =>
  failedOnTheWire('POST', '_action=UNLOCK&lockHandle=SECRET01');

function recordingLogger(): { logger: ILogger; warned: string[] } {
  const warned: string[] = [];
  return {
    warned,
    logger: {
      debug: () => {},
      info: () => {},
      error: () => {},
      warn: (message: string) => {
        warned.push(message);
      },
    },
  };
}

function handler(overrides: Record<string, jest.Mock> = {}) {
  return {
    lock: jest.fn(async () => ok('SECRET01')),
    update: jest.fn(async () => ok('')),
    unlock: jest.fn(async () => ok('')),
    activate: jest.fn(async () => ok('')),
    ...overrides,
  };
}

async function thrownBy(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the step to fail');
}

function expectSapAnswer(text: string | undefined): void {
  expect(text).toBeDefined();
  for (const part of SAP_ANSWER) expect(text).toContain(part);
  expect(text).not.toContain('SECRET01');
  expect(text).not.toContain('_action=');
}

describe("test-helper.js step failures carry SAP's answer, never the lock handle", () => {
  it('writeSource fails a refused unlock with it', async () => {
    const { logger } = recordingLogger();
    const thrown = await thrownBy(() =>
      writeSource(
        handler({ unlock: jest.fn(async () => refusedUnlock()) }),
        { interfaceName: 'ZTHING' },
        { source: 'INTERFACE zthing.' },
        logger,
      ),
    );
    expect(thrown).toContain('unlock failed');
    expectSapAnswer(thrown);
  });

  it('writeSource logs a refused unlock beside a failed write with it', async () => {
    const { logger, warned } = recordingLogger();
    const thrown = await thrownBy(() =>
      writeSource(
        handler({
          update: jest.fn(async () =>
            failedOnTheWire('PUT', 'lockHandle=SECRET01'),
          ),
          unlock: jest.fn(async () => refusedUnlock()),
        }),
        { interfaceName: 'ZTHING' },
        { source: 'INTERFACE zthing.' },
        logger,
      ),
    );
    expect(thrown).toContain('update failed');
    expectSapAnswer(thrown);
    expectSapAnswer(warned.find((line) => line.includes('unlock failed')));
  });

  it('writeAndActivate fails a refused activation with it', async () => {
    const thrown = await thrownBy(() =>
      writeAndActivate(
        handler({
          activate: jest.fn(async () =>
            failedOnTheWire('POST', 'method=activate&lockHandle=SECRET01'),
          ),
        }),
        { interfaceName: 'ZTHING' },
        { source: 'INTERFACE zthing.' },
        recordingLogger().logger,
      ),
    );
    expect(thrown).toContain('activate failed');
    expectSapAnswer(thrown);
  });

  it('mustSucceed names the request by its path alone', () => {
    let thrown = '';
    try {
      mustSucceed(failedOnTheWire('PUT', 'lockHandle=SECRET01'), 'update');
    } catch (error) {
      thrown = error instanceof Error ? error.message : String(error);
    }
    expect(thrown).toContain('update failed');
    expectSapAnswer(thrown);
  });
});
