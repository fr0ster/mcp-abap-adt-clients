/**
 * Unit tests for AdtClient's session-scoped lock registry and its best-effort
 * `Symbol.asyncDispose`.
 *
 * A fake IAbapConnection injects the lock handle and forces the unlock to fail
 * deterministically (a busy-context unlock cannot be reproduced live on demand).
 * The object name comes from test-config.yaml via TestConfigResolver.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
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

/** Fake connection: LOCK → handle, UNLOCK → throws, everything else → 200. */
function failingUnlockConnection(): IAbapConnection {
  const makeAdtRequest = jest.fn(async (req: any) => {
    if (String(req.url).includes('_action=LOCK')) {
      return { status: 200, data: LOCK_XML };
    }
    if (String(req.url).includes('_action=UNLOCK')) {
      throw new Error('context busy');
    }
    return { status: 200, data: '' };
  });
  const setSessionType = jest.fn();
  return { makeAdtRequest, setSessionType } as unknown as IAbapConnection;
}

describe('AdtClient lock registry dispose', () => {
  const resolver = new TestConfigResolver({
    handlerName: 'create_domain',
    testCaseName: 'adt_domain',
    logger: testsLogger,
  });
  const domainName: string = resolver.getParams().domain_name;
  const lockKey = `Domain/${String(domainName).toUpperCase()}`;

  it('await using dispose is best-effort: it does not throw and leaves the failed lock observable in pendingLocks', async () => {
    logTestStart(testsLogger, 'AdtClient dispose - best-effort', {
      name: 'dispose_best_effort',
      params: { domain_name: domainName },
    });

    const warn = jest.fn();
    const logger: ILogger = {
      debug: () => {},
      info: () => {},
      warn,
      error: () => {},
    };
    const client = new AdtClient(failingUnlockConnection(), logger);

    await client.getDomain().lock({ domainName });
    expect(client.pendingLocks).toEqual([lockKey]);

    // Dispose must not throw even though the unlock fails...
    await expect(client[Symbol.asyncDispose]()).resolves.toBeUndefined();

    // ...and the unreleased lock stays observable (retained, not lost),
    // with a warning emitted so the failure is not silent.
    expect(client.pendingLocks).toEqual([lockKey]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(lockKey);

    logTestSuccess(testsLogger, 'AdtClient dispose - best-effort');
    logTestEnd(testsLogger, 'AdtClient dispose - best-effort');
  });
});
