/**
 * Integration test for the session-scoped lock registry (final unlock safety net).
 *
 * Proves end-to-end against a real SAP system that:
 *  - AdtDomain.lock() records the held lock in the client's session-scoped registry
 *  - AdtClient.unlockAll() releases a lock the caller never unlocked, and SAP
 *    accepts the UNLOCK (no failures)
 *
 * This is the "last resort" cleanup, not the primary defense — preventing a
 * timeout from interrupting the lock→unlock critical section stays with the caller.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Domain library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=domain/DomainLockRegistry
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IDomainConfig } from '../../../../core/domain';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import {
  deleteDomain,
  recreateActiveDomain,
} from '../../../helpers/lockTargets';
import {
  createTestAdtClient,
  createTestConnection,
  getConfig,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const TEST_NAME = 'Domain - lock registry final unlock';

describe('Domain lock registry (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let config: IDomainConfig | undefined;
  let domainType: { datatype?: string; length?: number; decimals?: number } =
    {};

  beforeAll(async () => {
    try {
      const sapConfig = getConfig();
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;

      // Resolve domain params from test-config.yaml (no hardcoding).
      const resolver = new TestConfigResolver({
        handlerName: 'create_domain',
        // Its own object: sharing adt_domain's name made Domain's full
        // workflow skip as "already exists" on every run.
        // One owner per object. Sharing a name with another test is what made
        // Domain's full workflow skip as "already exists" on every run.
        testCaseName: 'domain_lock_registry',
        isCloud: isCloudSystem,
        logger: testsLogger,
      });
      const params = resolver.getParams();
      const packageName = resolver.getPackageName();
      if (params?.domain_name && packageName) {
        config = {
          domainName: params.domain_name,
          packageName,
          transportRequest: resolver.getTransportRequest(),
          description: params.description,
        };
        domainType = {
          datatype: params.datatype,
          length: params.length,
          decimals: params.decimals,
        };
      }
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  it(
    'unlockAll() releases a lock the caller never unlocked',
    async () => {
      logTestStart(testsLogger, TEST_NAME, {
        name: 'lock_registry_final_unlock',
        params: { domain_name: config?.domainName },
      });

      if (!hasConfig || !client || !config) {
        logTestSkip(testsLogger, TEST_NAME, 'No SAP configuration');
        return;
      }

      try {
        // A typed, active domain, not the shell a create alone makes.
        await recreateActiveDomain(client, config, domainType);

        // Lock through the client — the handler records it in the session-scoped
        // registry. Deliberately do NOT unlock here.
        const domain = client.getDomain();
        const lockHandle = expectResult(
          await domain.lock(config),
          'lockHandle',
        );
        expect(typeof lockHandle).toBe('string');
        expect(lockHandle.length).toBeGreaterThan(0);

        // Last-resort cleanup releases the abandoned lock; SAP must accept it.
        const failures = await client.unlockAll();
        expect(failures).toEqual([]);

        logTestSuccess(testsLogger, TEST_NAME);
      } catch (error) {
        logTestError(testsLogger, TEST_NAME, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, TEST_NAME);
      }
    },
    getTimeout('test'),
  );

  // A failed cleanup fails the suite: the leftover is what this used to be.
  afterAll(async () => {
    if (!client || !config) return;
    // A lock the test left held blocks the delete rather than enabling it.
    await client.unlockAll();
    await deleteDomain(client, config);
  }, 300000);
});
