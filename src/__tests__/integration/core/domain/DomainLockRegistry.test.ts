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
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IDomainConfig } from '../../../../core/domain';
import { getDomain } from '../../../../core/domain/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
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

  beforeAll(async () => {
    try {
      const sapConfig = getConfig();
      connection = createAbapConnection(sapConfig, connectionLogger);
      await (connection as any).connect();
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
        testCaseName: 'adt_domain',
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
          datatype: params.datatype || 'CHAR',
          length: params.length || 5,
          decimals: params.decimals,
          lowercase: params.lowercase,
          sign_exists: params.sign_exists,
        };
      }
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
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
        // Ensure the domain exists (idempotent: create it only if missing).
        try {
          await getDomain(connection, config.domainName);
        } catch (error: any) {
          if (error?.response?.status === 404) {
            await client.getDomain().create(config);
          } else {
            throw error;
          }
        }

        // Lock through the client — the handler records it in the session-scoped
        // registry. Deliberately do NOT unlock here.
        const domain = client.getDomain();
        const lockHandle = await domain.lock(config);
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
});
