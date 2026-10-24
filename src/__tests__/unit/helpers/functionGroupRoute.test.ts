/**
 * The function group a FunctionModule / FunctionInclude flow builds in comes
 * by the route its case states. Each route's failure is the setup's failure:
 * the default-package route is never a recovery from a failed shared setup,
 * a read that could not find out is never "absent", and a refused create is
 * never redeemed by a later read.
 */
jest.mock('../../helpers/adtHeaders', () => ({
  integrationHeadersOf: () => ({
    accept: 'text/plain',
    contentType: 'text/plain',
  }),
}));

import {
  ensureFunctionGroupFor,
  functionGroupRouteOf,
  type ISharedSetup,
} from '../../helpers/functionGroupRoute';

const ok = (value: unknown = '') =>
  ({ ok: true, getResult: () => ({ value }) }) as never;
const refused = (message: string, status?: number) =>
  ({
    ok: false,
    getError: () => ({
      origin: 'refusal',
      message,
      response: { status, data: '' },
    }),
  }) as never;

function setupWith(overrides: Partial<ISharedSetup> = {}): ISharedSetup {
  return {
    ensureSharedPackage: jest.fn(async () => undefined),
    ensureSharedDependency: jest.fn(async () => undefined),
    resolvePackageName: () => 'ZPKG',
    resolveTransportRequest: () => undefined,
    ...overrides,
  };
}

function clientWith(read: jest.Mock, create: jest.Mock = jest.fn()) {
  return { getFunctionGroup: () => ({ readMetadata: read, create }) };
}

const LABEL = 'create_function_module[adt_function_module]';
const shared = { function_group_name: 'ZFG', function_group_route: 'shared' };
const inPackage = {
  function_group_name: 'ZFG',
  function_group_route: 'default_package',
};

describe('functionGroupRouteOf', () => {
  it('reads the two routes', () => {
    expect(functionGroupRouteOf(shared, LABEL)).toBe('shared');
    expect(functionGroupRouteOf(inPackage, LABEL)).toBe('default_package');
  });

  it('throws a configuration defect for a missing or unknown route', () => {
    expect(() => functionGroupRouteOf({}, LABEL)).toThrow(
      /params.function_group_route must be/,
    );
    expect(() =>
      functionGroupRouteOf({ function_group_route: 'fallback' }, LABEL),
    ).toThrow(/got "fallback"/);
  });
});

describe('ensureFunctionGroupFor — the shared route', () => {
  it('fails when the shared package setup fails, and never falls back', async () => {
    const read = jest.fn();
    const setup = setupWith({
      ensureSharedPackage: jest.fn(async () => {
        throw new Error('no transport layer');
      }),
    });
    await expect(
      ensureFunctionGroupFor(
        clientWith(read),
        shared,
        LABEL,
        'd',
        undefined,
        setup,
      ),
    ).rejects.toThrow('no transport layer');
    expect(read).not.toHaveBeenCalled();
  });

  it('fails when the shared dependency setup fails', async () => {
    const read = jest.fn();
    const setup = setupWith({
      ensureSharedDependency: jest.fn(async () => {
        throw new Error('group still inactive');
      }),
    });
    await expect(
      ensureFunctionGroupFor(
        clientWith(read),
        shared,
        LABEL,
        'd',
        undefined,
        setup,
      ),
    ).rejects.toThrow('group still inactive');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('ensureFunctionGroupFor — the default-package route', () => {
  it('creates an absent group', async () => {
    const create = jest.fn(async () => ok());
    await ensureFunctionGroupFor(
      clientWith(
        jest.fn(async () => refused('not found', 404)),
        create,
      ),
      inPackage,
      LABEL,
      'd',
      undefined,
      setupWith(),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('fails when the read cannot find out, and creates nothing', async () => {
    const create = jest.fn(async () => ok());
    await expect(
      ensureFunctionGroupFor(
        clientWith(
          jest.fn(async () => refused('not authorized', 403)),
          create,
        ),
        inPackage,
        LABEL,
        'd',
        undefined,
        setupWith(),
      ),
    ).rejects.toThrow(/Cannot verify function group ZFG/);
    expect(create).not.toHaveBeenCalled();
  });

  it('fails on a refused create, although a read afterwards finds the group', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce(refused('not found', 404))
      .mockResolvedValue(ok('<group/>'));
    const create = jest.fn(async () => refused('no suitable component', 409));
    await expect(
      ensureFunctionGroupFor(
        clientWith(read, create),
        inPackage,
        LABEL,
        'd',
        undefined,
        setupWith(),
      ),
    ).rejects.toThrow(/create function group ZFG.*no suitable component/);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('fails on a create that throws', async () => {
    await expect(
      ensureFunctionGroupFor(
        clientWith(
          jest.fn(async () => refused('not found', 404)),
          jest.fn(async () => {
            throw new Error('ECONNRESET');
          }),
        ),
        inPackage,
        LABEL,
        'd',
        undefined,
        setupWith(),
      ),
    ).rejects.toThrow('ECONNRESET');
  });

  it('never runs the shared setup', async () => {
    const setup = setupWith();
    await ensureFunctionGroupFor(
      clientWith(jest.fn(async () => ok('<group/>'))),
      inPackage,
      LABEL,
      'd',
      undefined,
      setup,
    );
    expect(setup.ensureSharedPackage).not.toHaveBeenCalled();
  });
});
