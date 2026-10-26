/**
 * Whether the lock-release check is made is the system's configuration,
 * `environment.verify_lock_released`. Off, nothing is sent — no second
 * session is opened — and the run logs a line naming the key. Missing, the
 * check refuses before anything is sent. On, the second session is opened
 * (and a refused LOCK fails, as lockReleased.test.ts proves).
 */
let mockEnvironment: Record<string, unknown> = {};
const opened = jest.fn();
const said: string[] = [];

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  getEnvironmentConfig: () => mockEnvironment,
}));
jest.mock('../../helpers/sessionConfig', () => ({
  ...jest.requireActual('../../helpers/sessionConfig'),
  createTestConnection: async () => {
    opened();
    throw new Error('a second session was opened');
  },
}));
jest.mock('../../helpers/testLogger', () => ({
  ...jest.requireActual('../../helpers/testLogger'),
  createRunIntegrityLogger: () => ({
    info: (line: string) => said.push(line),
    debug() {},
    warn() {},
    error() {},
  }),
}));

import { expectLockReleased } from '../../helpers/lockReleased';

const openHandler = jest.fn();

beforeEach(() => {
  opened.mockClear();
  openHandler.mockClear();
  said.length = 0;
});

describe('expectLockReleased follows the configuration', () => {
  it('off: opens no session, sends nothing, and says so naming the key', async () => {
    mockEnvironment = { verify_lock_released: false };
    await expect(
      expectLockReleased(openHandler, {}, 'class ZX'),
    ).resolves.toBeUndefined();
    expect(opened).not.toHaveBeenCalled();
    expect(openHandler).not.toHaveBeenCalled();
    expect(said.join('\n')).toMatch(
      /class ZX: lock-release check not made — environment\.verify_lock_released is false/,
    );
  });

  it('on: opens the second session', async () => {
    mockEnvironment = { verify_lock_released: true };
    await expect(
      expectLockReleased(openHandler, {}, 'class ZX'),
    ).rejects.toThrow('a second session was opened');
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('missing: refuses before anything is sent', async () => {
    mockEnvironment = {};
    await expect(
      expectLockReleased(openHandler, {}, 'class ZX'),
    ).rejects.toThrow(/environment\.verify_lock_released is not set/);
    expect(opened).not.toHaveBeenCalled();
  });
});
