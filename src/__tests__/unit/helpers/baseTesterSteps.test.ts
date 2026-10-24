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

function testerOver(handler: ReturnType<typeof fakeHandler>) {
  const tester = new BaseTester<{ thingName: string }>(
    handler as never,
    'Thing',
    'create_thing',
    'adt_thing',
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
  process.env.VERIFY_LOCK_RELEASED = 'false';
  mockConfig = {
    environment: {
      system: 'onprem',
      operation_delays: { default: 1 },
    },
    session_config: { cleanup_session_after_test: false },
  };
});

afterAll(() => {
  delete process.env.VERIFY_LOCK_RELEASED;
});

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
      isLegacySystem: false,
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
