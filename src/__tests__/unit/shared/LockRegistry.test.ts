/**
 * Unit tests for the session-scoped LockRegistry (final unlock safety net).
 *
 * The registry is object-type agnostic, so the tests drive it with keys built
 * from real object names resolved from test-config.yaml via TestConfigResolver —
 * no hardcoded object names.
 */

import type { ILogger } from '@mcp-abap-adt/interfaces';
import { LockRegistry } from '../../../core/shared/LockRegistry';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestStart,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

describe('LockRegistry', () => {
  const domainResolver = new TestConfigResolver({
    handlerName: 'create_domain',
    testCaseName: 'adt_domain',
    logger: testsLogger,
  });
  const dataElementResolver = new TestConfigResolver({
    handlerName: 'create_data_element',
    testCaseName: 'adt_data_element',
    logger: testsLogger,
  });
  const keyA = `Domain/${String(domainResolver.getParams().domain_name).toUpperCase()}`;
  const keyB = `DataElement/${String(dataElementResolver.getParams().data_element_name).toUpperCase()}`;

  it('unlockAll invokes the unlock thunk for every tracked object and clears them', async () => {
    logTestStart(testsLogger, 'LockRegistry - unlockAll clears all', {
      name: 'unlockall_clears',
      params: { keyA, keyB },
    });
    const registry = new LockRegistry();
    const unlocked: string[] = [];

    registry.track(keyA, async () => {
      unlocked.push(keyA);
    });
    registry.track(keyB, async () => {
      unlocked.push(keyB);
    });

    const failures = await registry.unlockAll();

    expect(unlocked.sort()).toEqual([keyA, keyB].sort());
    expect(failures).toEqual([]);
    expect(registry.pending).toEqual([]);
    logTestSuccess(testsLogger, 'LockRegistry - unlockAll clears all');
    logTestEnd(testsLogger, 'LockRegistry - unlockAll clears all');
  });

  it('does not unlock an object that was already untracked (clean unlock)', async () => {
    logTestStart(testsLogger, 'LockRegistry - untrack skips unlock', {
      name: 'untrack_skips',
      params: { keyA },
    });
    const registry = new LockRegistry();
    const unlocked: string[] = [];

    registry.track(keyA, async () => {
      unlocked.push(keyA);
    });
    // Handler released it normally and told the registry.
    registry.untrack(keyA);

    const failures = await registry.unlockAll();

    expect(unlocked).toEqual([]);
    expect(failures).toEqual([]);
    expect(registry.pending).toEqual([]);
    logTestSuccess(testsLogger, 'LockRegistry - untrack skips unlock');
    logTestEnd(testsLogger, 'LockRegistry - untrack skips unlock');
  });

  it('keeps locks whose unlock throws and reports them, still releasing the others', async () => {
    logTestStart(testsLogger, 'LockRegistry - retains failed unlock', {
      name: 'retains_failed',
      params: { keyA, keyB },
    });
    const registry = new LockRegistry();
    const unlocked: string[] = [];
    const boom = new Error('context busy');

    registry.track(keyA, async () => {
      throw boom;
    });
    registry.track(keyB, async () => {
      unlocked.push(keyB);
    });

    const failures = await registry.unlockAll();

    expect(unlocked).toEqual([keyB]);
    expect(failures).toEqual([{ key: keyA, error: boom }]);
    // The failed lock is retained so a later retry / session-drop can handle it.
    expect(registry.pending).toEqual([keyA]);
    logTestSuccess(testsLogger, 'LockRegistry - retains failed unlock');
    logTestEnd(testsLogger, 'LockRegistry - retains failed unlock');
  });
});
