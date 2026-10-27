/**
 * The shared-dependency setup in test-helper.js fails on every refused or
 * throwing step, and nothing after a failure forgives it: a read that could
 * not find out is never "absent", a refused create is never redeemed by a
 * later read, and a group that could not be made active is never ready.
 */

// The headers each member sends are recorded per real handler class; the
// fakes below are none of them, and what they are sent is not under test.
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

const {
  activateSharedFunctionGroup,
  ensureSharedPackage,
  ensureSharedDependency,
  resetSharedDependencyCache,
} = require('../../helpers/test-helper');

type Answer = { ok: boolean };
const ok = (value: unknown = ''): Answer =>
  ({ ok: true, getResult: () => ({ value }) }) as Answer;
const refused = (message: string, status?: number, data = ''): Answer =>
  ({
    ok: false,
    getError: () => ({
      origin: 'refusal',
      message,
      response: { status, data },
    }),
  }) as Answer;
const absent = () => refused('Request failed with status code 404', 404);

const logger = { debug() {}, info() {}, warn() {}, error() {} };

/** A client whose members answer what each test says, recording calls. */
function fakeClient(members: Record<string, Record<string, jest.Mock>>) {
  const calls: string[] = [];
  const client: Record<string, unknown> = {};
  for (const [factory, handler] of Object.entries(members)) {
    const recorded: Record<string, jest.Mock> = {};
    for (const [name, fn] of Object.entries(handler)) {
      recorded[name] = jest.fn(async (...args: unknown[]) => {
        calls.push(`${factory}.${name}`);
        return fn(...args);
      });
    }
    client[factory] = () => recorded;
  }
  return { client, calls };
}

const GROUP = 'ZAC_SHR_FUGR'; // shared_dependencies.function_groups of the template
const CLASS = 'ZAC_SHR_RUN01'; // shared_dependencies.classes of the template

const inactiveList = (objects: { type: string; name: string }[]) =>
  jest.fn(async () => ok({ objects }));

beforeEach(() => resetSharedDependencyCache());

describe('activateSharedFunctionGroup', () => {
  const group = (activate: jest.Mock, list: jest.Mock) =>
    fakeClient({
      getFunctionGroup: { activate },
      getUtils: { getInactiveObjects: list },
    }).client;

  it('resolves when the group is off the inactive list', async () => {
    await expect(
      activateSharedFunctionGroup(
        group(
          jest.fn(async () => ok()),
          inactiveList([]),
        ),
        GROUP,
        undefined,
        logger,
      ),
    ).resolves.toBe(true);
  });

  it('throws on a refused activation', async () => {
    await expect(
      activateSharedFunctionGroup(
        group(
          jest.fn(async () => refused('activation refused')),
          inactiveList([]),
        ),
        GROUP,
        undefined,
        logger,
      ),
    ).rejects.toThrow(/could not be activated: activation refused/);
  });

  it('throws when the inactive list cannot be read', async () => {
    await expect(
      activateSharedFunctionGroup(
        group(
          jest.fn(async () => ok()),
          jest.fn(async () => refused('list refused')),
        ),
        GROUP,
        undefined,
        logger,
      ),
    ).rejects.toThrow(/inactive list could not be read.*list refused/);
  });

  it('throws when the group is still inactive', async () => {
    await expect(
      activateSharedFunctionGroup(
        group(
          jest.fn(async () => ok()),
          inactiveList([{ type: 'FUGR/I', name: `SAPL${GROUP}` }]),
        ),
        GROUP,
        undefined,
        logger,
      ),
    ).rejects.toThrow(/still inactive/);
  });

  it('lets a thrown activation through', async () => {
    await expect(
      activateSharedFunctionGroup(
        group(
          jest.fn(async () => {
            throw new Error('socket hang up');
          }),
          inactiveList([]),
        ),
        GROUP,
        undefined,
        logger,
      ),
    ).rejects.toThrow('socket hang up');
  });
});

describe('ensureSharedPackage', () => {
  it('creates an absent package', async () => {
    const { client, calls } = fakeClient({
      getPackage: {
        readMetadata: jest.fn(async () => absent()),
        create: jest.fn(async () => ok()),
      },
    });
    await ensureSharedPackage(client, logger);
    expect(calls).toEqual(['getPackage.readMetadata', 'getPackage.create']);
  });

  it('fails on a refused read that does not say absent, and creates nothing', async () => {
    const { client, calls } = fakeClient({
      getPackage: {
        readMetadata: jest.fn(async () => refused('not authorized', 403)),
        create: jest.fn(async () => ok()),
      },
    });
    await expect(ensureSharedPackage(client, logger)).rejects.toThrow(
      /Could not determine whether shared package .* exists: not authorized/,
    );
    expect(calls).toEqual(['getPackage.readMetadata']);
  });

  it('fails on a read that throws, and creates nothing', async () => {
    const { client, calls } = fakeClient({
      getPackage: {
        readMetadata: jest.fn(async () => {
          throw new Error('ECONNRESET');
        }),
        create: jest.fn(async () => ok()),
      },
    });
    await expect(ensureSharedPackage(client, logger)).rejects.toThrow(
      'ECONNRESET',
    );
    expect(calls).toEqual(['getPackage.readMetadata']);
  });

  it('fails on a refused create — a 409 "already exists" included', async () => {
    const { client, calls } = fakeClient({
      getPackage: {
        readMetadata: jest.fn(async () => absent()),
        create: jest.fn(async () =>
          refused('Resource Package does already exist', 409),
        ),
      },
      getUtils: { search: jest.fn(async () => ok('ZAC_SHR_PKG')) },
    });
    await expect(ensureSharedPackage(client, logger)).rejects.toThrow(
      /shared package create .* failed .*409.*already exist/,
    );
    expect(calls).toEqual(['getPackage.readMetadata', 'getPackage.create']);
  });
});

describe('ensureSharedDependency', () => {
  it('fails on a refused function group create, with no read to forgive it', async () => {
    const { client, calls } = fakeClient({
      getFunctionGroup: {
        readMetadata: jest
          .fn()
          .mockResolvedValueOnce(absent())
          .mockResolvedValue(ok('<group/>')),
        create: jest.fn(async () => refused('no suitable component', 409)),
        activate: jest.fn(async () => ok()),
      },
      getUtils: { getInactiveObjects: inactiveList([]) },
    });
    await expect(
      ensureSharedDependency(client, 'function_groups', GROUP, logger),
    ).rejects.toThrow(/shared functiongroup create .* no suitable component/);
    expect(calls).toEqual([
      'getFunctionGroup.readMetadata',
      'getFunctionGroup.create',
    ]);
  });

  it('fails when an existing group cannot be made active, and is not cached', async () => {
    const { client, calls } = fakeClient({
      getFunctionGroup: {
        readMetadata: jest.fn(async () => ok('<group/>')),
        activate: jest.fn(async () => refused('activation refused')),
      },
    });
    await expect(
      ensureSharedDependency(client, 'function_groups', GROUP, logger),
    ).rejects.toThrow(/could not be activated/);
    await expect(
      ensureSharedDependency(client, 'function_groups', GROUP, logger),
    ).rejects.toThrow(/could not be activated/);
    expect(calls.filter((c) => c.endsWith('.activate'))).toHaveLength(2);
  });

  it('fails when a created group cannot be made active', async () => {
    const { client } = fakeClient({
      getFunctionGroup: {
        readMetadata: jest.fn(async () => absent()),
        create: jest.fn(async () => ok()),
        activate: jest.fn(async () => ok()),
      },
      getUtils: {
        getInactiveObjects: inactiveList([{ type: 'FUGR/F', name: GROUP }]),
      },
    });
    await expect(
      ensureSharedDependency(client, 'function_groups', GROUP, logger),
    ).rejects.toThrow(/still inactive/);
  });

  it('fails on a refused read of the active source, and writes nothing', async () => {
    const { client, calls } = fakeClient({
      getClass: {
        readMetadata: jest.fn(async () => ok('<class/>')),
        read: jest.fn(async () => refused('not authorized', 403)),
        lock: jest.fn(async () => ok('HANDLE')),
        update: jest.fn(async () => ok()),
        unlock: jest.fn(async () => ok()),
        activate: jest.fn(async () => ok()),
      },
    });
    await expect(
      ensureSharedDependency(client, 'classes', CLASS, logger),
    ).rejects.toThrow(/Could not read the active source .*not authorized/);
    expect(calls).toEqual(['getClass.readMetadata', 'getClass.read']);
  });

  it('fails on a thrown read of the active source, and writes nothing', async () => {
    const { client, calls } = fakeClient({
      getClass: {
        readMetadata: jest.fn(async () => ok('<class/>')),
        read: jest.fn(async () => {
          throw new Error('ETIMEDOUT');
        }),
        lock: jest.fn(async () => ok('HANDLE')),
      },
    });
    await expect(
      ensureSharedDependency(client, 'classes', CLASS, logger),
    ).rejects.toThrow('ETIMEDOUT');
    expect(calls).not.toContain('getClass.lock');
  });

  it('writes an object whose active source is absent', async () => {
    const { client, calls } = fakeClient({
      getClass: {
        readMetadata: jest.fn(async () => ok('<class/>')),
        read: jest.fn(async () => absent()),
        lock: jest.fn(async () => ok('HANDLE')),
        update: jest.fn(async () => ok()),
        unlock: jest.fn(async () => ok()),
        activate: jest.fn(async () => ok()),
      },
    });
    await ensureSharedDependency(client, 'classes', CLASS, logger);
    expect(calls).toContain('getClass.update');
  });
});

describe('createDependencyDomain', () => {
  const { createDependencyDomain } = require('../../helpers/test-helper');
  const domain = {
    domainName: 'ZAC_DOM',
    packageName: 'ZPKG',
    dataType: 'CHAR',
    length: 10,
  };
  const delays = { params: { operation_delays: { default: 0 } } };

  it('fails on a refused create, and names a cleanup that failed too', async () => {
    const client = {
      validateDomain: jest.fn(async () => ({ status: 200, data: '' })),
      createDomain: jest.fn(async () => ok()),
      lockDomain: jest.fn(async () => refused('locked by ZOTHER')),
      deleteDomain: jest.fn(async () => refused('delete refused')),
    };
    const result = await createDependencyDomain(client, domain, delays);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/lockDomain failed .*locked by ZOTHER/);
    expect(result.reason).toMatch(
      /cleanup after it failed too: .*delete refused/,
    );
  });

  it('fails on a refused create step', async () => {
    const client = {
      validateDomain: jest.fn(async () => ({ status: 200, data: '' })),
      createDomain: jest.fn(async () => refused('no authorization')),
    };
    const result = await createDependencyDomain(client, domain, delays);
    expect(result).toMatchObject({ success: false, created: false });
    expect(result.reason).toMatch(/createDomain failed .*no authorization/);
  });
});
