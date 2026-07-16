/**
 * Unit tests for AdtDomain ↔ LockRegistry wiring.
 *
 * A fake IAbapConnection is used only to inject the lock handle and to force
 * failure paths deterministically (a busy-context unlock cannot be reproduced
 * on a live system on demand). All object parameters (domain name, package)
 * come from test-config.yaml via TestConfigResolver — never hardcoded.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtDomain } from '../../../core/domain/AdtDomain';
import { LockRegistry } from '../../../core/shared/LockRegistry';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestStart,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>HANDLE123</LOCK_HANDLE></DATA></asx:values></asx:abap>';

/** Fake connection: answers LOCK with a handle, everything else with 200/empty. */
function fakeConnection(): { conn: IAbapConnection; calls: any[] } {
  const calls: any[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    if (String(req.url).includes('_action=LOCK')) {
      return { status: 200, data: LOCK_XML };
    }
    return { status: 200, data: '' };
  });
  const setSessionType = jest.fn();
  return {
    conn: { makeAdtRequest, setSessionType } as unknown as IAbapConnection,
    calls,
  };
}

describe('AdtDomain lock registry wiring', () => {
  const resolver = new TestConfigResolver({
    handlerName: 'create_domain',
    testCaseName: 'adt_domain',
    logger: testsLogger,
  });
  const params = resolver.getParams();
  const domainName: string = params.domain_name;
  const packageName = resolver.getPackageName();
  const lockKey = `Domain/${String(domainName).toUpperCase()}`;

  it('lock() records the held lock in the injected registry', async () => {
    logTestStart(testsLogger, 'Domain lock registry - lock() tracks', {
      name: 'lock_tracks',
      params: { domain_name: domainName },
    });
    const { conn } = fakeConnection();
    const registry = new LockRegistry();
    const domain = new AdtDomain(conn, undefined, undefined, registry);

    await domain.lock({ domainName });

    expect(registry.pending).toEqual([lockKey]);
    logTestSuccess(testsLogger, 'Domain lock registry - lock() tracks');
    logTestEnd(testsLogger, 'Domain lock registry - lock() tracks');
  });

  it('unlock() removes the lock from the registry', async () => {
    logTestStart(testsLogger, 'Domain lock registry - unlock() untracks', {
      name: 'unlock_untracks',
      params: { domain_name: domainName },
    });
    const { conn } = fakeConnection();
    const registry = new LockRegistry();
    const domain = new AdtDomain(conn, undefined, undefined, registry);

    const handle = await domain.lock({ domainName });
    await domain.unlock({ domainName }, handle);

    expect(registry.pending).toEqual([]);
    logTestSuccess(testsLogger, 'Domain lock registry - unlock() untracks');
    logTestEnd(testsLogger, 'Domain lock registry - unlock() untracks');
  });

  it('registry.unlockAll() releases a lock the caller never unlocked', async () => {
    logTestStart(testsLogger, 'Domain lock registry - unlockAll() releases', {
      name: 'unlockall_releases',
      params: { domain_name: domainName },
    });
    const { conn, calls } = fakeConnection();
    const registry = new LockRegistry();
    const domain = new AdtDomain(conn, undefined, undefined, registry);

    await domain.lock({ domainName });
    const failures = await registry.unlockAll();

    expect(failures).toEqual([]);
    expect(registry.pending).toEqual([]);
    const unlockCall = calls.find((c) =>
      String(c.url).includes('_action=UNLOCK'),
    );
    expect(unlockCall).toBeDefined();
    expect(String(unlockCall.url)).toContain('lockHandle=HANDLE123');
    logTestSuccess(testsLogger, 'Domain lock registry - unlockAll() releases');
    logTestEnd(testsLogger, 'Domain lock registry - unlockAll() releases');
  });

  it('managed update() retains the lock when the flow fails and cleanup unlock also fails', async () => {
    logTestStart(testsLogger, 'Domain lock registry - managed retention', {
      name: 'managed_retention',
      params: { domain_name: domainName, package_name: packageName },
    });
    // LOCK succeeds; the update read-modify-write fails; and the error-path
    // cleanup unlock ALSO fails (server context still busy). The registry must
    // keep the lock so unlockAll() is the last resort.
    const makeAdtRequest = jest.fn(async (req: any) => {
      if (String(req.url).includes('_action=LOCK')) {
        return { status: 200, data: LOCK_XML };
      }
      if (String(req.url).includes('_action=UNLOCK')) {
        throw new Error('context busy');
      }
      throw new Error('update failed');
    });
    const setSessionType = jest.fn();
    const conn = {
      makeAdtRequest,
      setSessionType,
    } as unknown as IAbapConnection;
    const registry = new LockRegistry();
    const domain = new AdtDomain(conn, undefined, undefined, registry);

    await expect(domain.update({ domainName, packageName })).rejects.toThrow();

    expect(registry.pending).toEqual([lockKey]);
    logTestSuccess(testsLogger, 'Domain lock registry - managed retention');
    logTestEnd(testsLogger, 'Domain lock registry - managed retention');
  });
});
