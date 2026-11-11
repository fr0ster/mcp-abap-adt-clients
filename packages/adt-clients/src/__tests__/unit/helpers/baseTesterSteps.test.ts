/**
 * A step of a `BaseTester` flow that answers `ok: false` fails the flow there,
 * with what SAP said — and the steps after it do not run.
 *
 * A refusal comes back as an answer, not a throw, so a step whose answer is
 * not read passes as done: an update that wrote nothing, an unlock that left
 * the handle held, a read that read nothing.
 */
let mockConfig: unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  loadTestConfig: () => mockConfig,
  getEnvironmentConfig: () =>
    (mockConfig as { environment: unknown }).environment,
  getSessionConfig: () =>
    (mockConfig as { session_config: unknown }).session_config,
  ensurePackageConfig: () => ({ success: true }),
}));

// The headers each member sends are recorded per real handler class; this
// fake is none of them, and what it is sent is not what is under test.
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import type { IAdtFailure } from '@mcp-abap-adt/interfaces-adt';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { BaseTester } from '../../helpers/BaseTester';

type Answer = { ok: boolean };
const ok = (value: unknown = ''): Answer =>
  ({ ok: true, getResult: () => ({ value }) }) as Answer;
const refused = (message: string, status?: number): Answer =>
  ({
    ok: false,
    getError: () => ({
      origin: 'refusal',
      message,
      ...(status ? { response: { status } } : {}),
    }),
  }) as Answer;

/** A handler whose every member answers ok unless the test says otherwise. */
function fakeHandler(overrides: Record<string, jest.Mock> = {}) {
  const answer = (value?: unknown) =>
    jest.fn(async (..._args: unknown[]) => ok(value));
  return {
    validate: answer(''),
    create: answer(),
    read: answer('source'),
    readMetadata: answer('<doc/>'),
    lock: answer('HANDLE'),
    update: answer(),
    unlock: answer(),
    activate: answer(),
    delete: answer(),
    ...overrides,
  };
}

function testerOver(handler: ReturnType<typeof fakeHandler>, logger?: ILogger) {
  const tester = new BaseTester<{ thingName: string }>(
    handler as never,
    'Thing',
    'create_thing',
    'adt_thing',
    logger,
  );
  tester.setup({
    connection: {} as never,
    client: {} as never,
    hasConfig: true,
    isCloudSystem: false,
    buildConfig: () => ({ thingName: 'ZTHING' }) as never,
  });
  return tester;
}

const config = { thingName: 'ZTHING' };
const updateConfig = { thingName: 'ZTHING' };

beforeEach(() => {
  mockConfig = {
    environment: {
      system: 'onprem',
      operation_delays: { default: 1 },
      verify_lock_released: false,
    },
    session_config: { cleanup_session_after_test: false },
  };
});

afterAll(() => {});

describe('BaseTester flowTest reads every step answer', () => {
  it('runs every step when each answers ok', async () => {
    const handler = fakeHandler();
    await testerOver(handler).flowTest(config, {}, { updateConfig });
    expect(handler.update).toHaveBeenCalledTimes(1);
    expect(handler.unlock).toHaveBeenCalledTimes(1);
    expect(handler.activate).toHaveBeenCalledTimes(1);
    expect(handler.delete).toHaveBeenCalledTimes(1);
  });

  it('fails at a refused update, with its reason, and activates nothing', async () => {
    const handler = fakeHandler({
      update: jest.fn(async () => refused('source is locked by ZOTHER')),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('update failed [refusal]: source is locked by ZOTHER');
    expect(handler.unlock).toHaveBeenCalledTimes(1);
    expect(handler.activate).not.toHaveBeenCalled();
  });

  it('fails at a refused unlock after an update that worked', async () => {
    const handler = fakeHandler({
      unlock: jest.fn(async () => refused('handle unknown')),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('unlock after update failed');
    expect(handler.activate).not.toHaveBeenCalled();
  });

  it('keeps a refused update the failure when the unlock is refused too', async () => {
    const handler = fakeHandler({
      update: jest.fn(async () => refused('the write was refused')),
      unlock: jest.fn(async () => refused('handle unknown')),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('update failed [refusal]: the write was refused');
  });

  it('fails at a refused validation — 404 included — and creates nothing', async () => {
    const handler = fakeHandler({
      validate: jest.fn(async () => refused('no validation resource', 404)),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('validate failed [refusal]: no validation resource');
    expect(handler.create).not.toHaveBeenCalled();
  });

  it('fails at a refused readMetadata step', async () => {
    const handler = fakeHandler({
      readMetadata: jest.fn(async () => refused('no document')),
    });
    await expect(
      testerOver(handler).flowTest(
        config,
        {},
        { updateConfig, readMetadata: true },
      ),
    ).rejects.toThrow('readMetadata failed [refusal]: no document');
  });
});

describe('a failing step logs its error text', () => {
  const EXCEPTION =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
    '<namespace id="com.sap.adt"/><type id="ExceptionResourceFailure"/>' +
    '<message lang="EN">Interface ZTHING could not be saved</message>' +
    '<localizedMessage lang="EN">Interface ZTHING could not be saved</localizedMessage>' +
    '<properties><entry key="T100KEY-ID">SEO_X</entry>' +
    '<entry key="T100KEY-NO">042</entry></properties></exc:exception>';
  const SOURCE_URL =
    '/sap/bc/adt/oo/interfaces/zthing/source/main?lockHandle=SECRET01&corrNr=X';
  const UNLOCK_URL =
    '/sap/bc/adt/oo/interfaces/zthing?_action=UNLOCK&lockHandle=SECRET01';
  const failedOnTheWire = (
    data: unknown,
    request: { method: string; url: string } = {
      method: 'PUT',
      url: SOURCE_URL,
    },
  ): IAdtFailure => ({
    ok: false,
    getError: () => ({
      origin: 'connection',
      message: 'Request failed with status code 500',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data,
      },
      request,
    }),
  });

  async function runAndCapture(
    overrides: Record<string, jest.Mock>,
    logger?: ILogger,
  ): Promise<{
    thrown: string;
    logged: string;
  }> {
    const lines: string[] = [];
    const write = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        lines.push(String(chunk));
        return true;
      });
    let thrown = '';
    try {
      await testerOver(fakeHandler(overrides), logger).flowTest(
        config,
        {},
        { updateConfig },
      );
    } catch (error) {
      thrown = error instanceof Error ? error.message : String(error);
    } finally {
      write.mockRestore();
    }
    return { thrown, logged: lines.join('') };
  }

  const SAP_ANSWER = [
    'Request failed with status code 500',
    'HTTP 500',
    'SEO_X/042',
    'Interface ZTHING could not be saved',
  ];

  it("logs SAP's status, message key and short text with the step", async () => {
    const { thrown, logged } = await runAndCapture({
      update: jest.fn(async () => failedOnTheWire(EXCEPTION)),
    });
    const step = logged
      .split('\n')
      .find((line) => line.includes('✗ update FAILED'));
    expect(step).toBeDefined();
    for (const part of [
      ...SAP_ANSWER,
      '/sap/bc/adt/oo/interfaces/zthing/source/main',
    ]) {
      expect(step).toContain(part);
      expect(thrown).toContain(part);
    }
  });

  it('never logs the request query, where the lock handle travels', async () => {
    const { thrown, logged } = await runAndCapture({
      update: jest.fn(async () => failedOnTheWire(EXCEPTION)),
    });
    expect(logged).not.toContain('SECRET01');
    expect(thrown).not.toContain('SECRET01');
  });

  it("fails a refused unlock with SAP's answer, never its lock handle", async () => {
    const { thrown, logged } = await runAndCapture({
      unlock: jest.fn(async () =>
        failedOnTheWire(EXCEPTION, { method: 'POST', url: UNLOCK_URL }),
      ),
    });
    const step = logged.split('\n').find((line) => line.includes('FAILED'));
    expect(step).toBeDefined();
    expect(thrown).toContain('unlock after update failed');
    for (const part of [...SAP_ANSWER, '/sap/bc/adt/oo/interfaces/zthing']) {
      expect(step).toContain(part);
      expect(thrown).toContain(part);
    }
    expect(logged).not.toContain('SECRET01');
    expect(thrown).not.toContain('SECRET01');
    expect(thrown).not.toContain('_action=UNLOCK');
  });

  it("logs a refused unlock beside a failed update with SAP's answer, never its lock handle", async () => {
    const warned: string[] = [];
    const logger: ILogger = {
      info: () => {},
      debug: () => {},
      error: () => {},
      warn: (message: string) => {
        warned.push(message);
      },
    };
    const { thrown } = await runAndCapture(
      {
        update: jest.fn(async () => refused('the write was refused')),
        unlock: jest.fn(async () =>
          failedOnTheWire(EXCEPTION, { method: 'POST', url: UNLOCK_URL }),
        ),
      },
      logger,
    );
    expect(thrown).toContain('update failed [refusal]: the write was refused');
    const line = warned.find((message) =>
      message.includes('unlock after update failed'),
    );
    expect(line).toBeDefined();
    for (const part of [...SAP_ANSWER, '/sap/bc/adt/oo/interfaces/zthing']) {
      expect(line).toContain(part);
    }
    expect(warned.join('\n')).not.toContain('SECRET01');
    expect(line).not.toContain('_action=UNLOCK');
  });

  it("fails a refused cleanup delete with SAP's answer, never the request query", async () => {
    const { thrown } = await runAndCapture({
      delete: jest.fn(async () =>
        failedOnTheWire(EXCEPTION, {
          method: 'DELETE',
          url: '/sap/bc/adt/oo/interfaces/zthing?lockHandle=SECRET01',
        }),
      ),
    });
    expect(thrown).toContain('cleanup failed');
    for (const part of [...SAP_ANSWER, '/sap/bc/adt/oo/interfaces/zthing']) {
      expect(thrown).toContain(part);
    }
    expect(thrown).not.toContain('SECRET01');
  });

  it('names a body that is not an ADT document by its length only', async () => {
    const { thrown } = await runAndCapture({
      update: jest.fn(async () => failedOnTheWire('<html>gateway down</html>')),
    });
    expect(thrown).toContain('HTTP 500');
    expect(thrown).toContain('25 characters, not an ADT document');
    expect(thrown).not.toContain('gateway down');
  });
});

describe('BaseTester modifyFlowTest reads every step answer', () => {
  it('fails at a refused update and activates nothing', async () => {
    const handler = fakeHandler({
      update: jest.fn(async () => refused('include not writable')),
    });
    await expect(
      testerOver(handler).modifyFlowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('update failed [refusal]: include not writable');
    expect(handler.activate).not.toHaveBeenCalled();
  });

  it('fails at a refused read, and updates nothing', async () => {
    const handler = fakeHandler({
      read: jest.fn(async () => refused('include not found')),
    });
    await expect(
      testerOver(handler).modifyFlowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('read initial failed [refusal]: include not found');
    expect(handler.update).not.toHaveBeenCalled();
  });

  it('fails at a refused activation', async () => {
    const handler = fakeHandler({
      activate: jest.fn(async () => refused('syntax error in line 3')),
    });
    await expect(
      testerOver(handler).modifyFlowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('activate failed [refusal]: syntax error in line 3');
  });
});

describe('BaseTester readTest reads the readMetadata answer', () => {
  it('fails at a refused readMetadata', async () => {
    const handler = fakeHandler({
      readMetadata: jest.fn(async () => refused('not authorised', 403)),
    });
    await expect(testerOver(handler).readTest(config)).rejects.toThrow(
      'readMetadata failed [refusal]: not authorised',
    );
  });

  it('passes over a 406 only where the case allows it', async () => {
    const handler = fakeHandler({
      readMetadata: jest.fn(async () => refused('Not Acceptable', 406)),
    });
    await expect(testerOver(handler).readTest(config)).rejects.toThrow(
      'readMetadata failed',
    );
    mockConfig = {
      ...(mockConfig as object),
      create_thing: {
        test_cases: [
          {
            name: 'adt_thing',
            enabled: true,
            params: { package_name: 'ZPKG', allow_406: true },
          },
        ],
      },
    };
    const allowing = testerOver(handler);
    await allowing.beforeEach()();
    await expect(allowing.readTest(config)).resolves.toBe('source');
  });
});

describe('BaseTester flowTest reads what it is answered beside the steps', () => {
  it('fails on a validation that answers an error table inside a 200', async () => {
    const handler = fakeHandler({
      validate: jest.fn(async () =>
        ok(
          '<adtcore:messageTable><adtcore:message adtcore:type="E" adtcore:text="Name ZTHING is taken"/></adtcore:messageTable>',
        ),
      ),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('Validation failed with errors: Name ZTHING is taken');
    expect(handler.create).not.toHaveBeenCalled();
  });

  function testerWithProperties(makeAdtRequest: jest.Mock) {
    const handler = fakeHandler();
    const tester = new BaseTester<{ programName: string }>(
      handler as never,
      'Thing',
      'create_thing',
      'adt_thing',
    );
    tester.setup({
      connection: { makeAdtRequest } as never,
      client: {
        getUtils: () => ({
          getObjectSourceUri: () =>
            '/sap/bc/adt/programs/programs/zthing/source/main',
        }),
      } as never,
      hasConfig: true,
      isCloudSystem: false,
      buildConfig: () => ({ programName: 'ZTHING' }) as never,
    });
    return { tester, handler };
  }
  const program = { programName: 'ZTHING' };

  it('reads the object properties after create, and passes on an answer', async () => {
    const request = jest.fn(async () => ({ status: 200, data: '<props/>' }));
    const { tester, handler } = testerWithProperties(request);
    await tester.flowTest(program as never, {}, { updateConfig: program });
    expect(request).toHaveBeenCalledTimes(1);
    expect(handler.update).toHaveBeenCalledTimes(1);
  });

  it('fails when the object properties read answers a non-2xx', async () => {
    const request = jest.fn(async () => ({ status: 500, data: 'dump' }));
    const { tester, handler } = testerWithProperties(request);
    await expect(
      tester.flowTest(program as never, {}, { updateConfig: program }),
    ).rejects.toThrow(/object properties answered HTTP 500/);
    expect(handler.update).not.toHaveBeenCalled();
  });

  it('fails when the object properties read throws', async () => {
    const request = jest.fn(async () => {
      throw new Error('Request failed with status code 403');
    });
    const { tester, handler } = testerWithProperties(request);
    await expect(
      tester.flowTest(program as never, {}, { updateConfig: program }),
    ).rejects.toThrow('Request failed with status code 403');
    expect(handler.update).not.toHaveBeenCalled();
  });

  it('names a failed cleanup inside the failure of the flow it followed', async () => {
    const handler = fakeHandler({
      update: jest.fn(async () => refused('the write was refused')),
      delete: jest.fn(async () => refused('delete refused: locked')),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow(
      /update failed \[refusal\]: the write was refused.*cleanup after it failed too.*delete refused: locked/,
    );
  });
});

describe('BaseTester asks the library to judge what answers inside a 200', () => {
  it('passes judges that refuse their own refusal form and an exception document', async () => {
    const { ADT_NO_FAILURE } = require('@mcp-abap-adt/interfaces-adt');
    const handler = fakeHandler();
    await testerOver(handler).flowTest(config, {}, { updateConfig });
    const judgeOf = (member: jest.Mock) =>
      (member.mock.calls[0] as unknown[])[1] as {
        analyse: (v: unknown, w: unknown) => unknown;
      };
    const refuses = (member: jest.Mock, data: string) =>
      judgeOf(member).analyse(ADT_NO_FAILURE, { status: 200, data }) !==
      ADT_NO_FAILURE;
    const EXC =
      '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="ExceptionResourceNoAccess"/><message lang="EN">No authorization</message></exc:exception>';
    for (const member of [handler.validate, handler.activate, handler.delete]) {
      expect(refuses(member, EXC)).toBe(true);
    }
    expect(
      refuses(
        handler.validate,
        '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>ERROR</SEVERITY><SHORT_TEXT>taken</SHORT_TEXT></DATA></asx:values></asx:abap>',
      ),
    ).toBe(true);
    expect(
      refuses(
        handler.activate,
        '<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true" activationExecuted="false" generationExecuted="false"/><msg type="W" objDescr="Class ZX"><shortText><txt>Object is locked in another session</txt></shortText></msg></chkl:messages>',
      ),
    ).toBe(true);
    expect(
      refuses(
        handler.delete,
        '<del:deletionResult xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object del:isDeleted="false" adtcore:name="ZX"><del:message del:type="E"><del:text>no</del:text></del:message></del:object></del:deletionResult>',
      ),
    ).toBe(true);
  });

  it('fails on a validation 200 carrying the SEVERITY ERROR envelope', async () => {
    const handler = fakeHandler({
      validate: jest.fn(async () =>
        ok(
          '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><SEVERITY>ERROR</SEVERITY><SHORT_TEXT>ZTHING already exists</SHORT_TEXT></DATA></asx:values></asx:abap>',
        ),
      ),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('Validation failed with errors: ZTHING already exists');
    expect(handler.create).not.toHaveBeenCalled();
  });

  it('fails on a validation 200 whose error sits nested under another prefix', async () => {
    const handler = fakeHandler({
      validate: jest.fn(async () =>
        ok(
          '<v:errorTable xmlns:v="x"><v:message v:type="E" v:text="Name is reserved"/></v:errorTable>',
        ),
      ),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow('Name is reserved');
    expect(handler.create).not.toHaveBeenCalled();
  });

  it('fails on an activation refused as ok=false', async () => {
    const handler = fakeHandler({
      activate: jest.fn(async () => refused('activationExecuted="false"')),
    });
    await expect(
      testerOver(handler).flowTest(config, {}, { updateConfig }),
    ).rejects.toThrow(/activationExecuted="false"/);
  });
});
