/**
 * Integration test for the session-scoped lock registry across object types.
 *
 * Proves end-to-end that ONE AdtClient session aggregates locks from different
 * handler types (Domain + DataElement), and that `unlockAll()` releases every
 * dangling lock in a single call — the "one session, all locks" design.
 *
 * All object parameters come from test-config.yaml via TestConfigResolver.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Library logs
 *  DEBUG_CONNECTORS=true  - Connection logs
 *
 * Run: npm test -- --testPathPatterns=domain/SessionLockRegistry
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IDataElementConfig } from '../../../../core/dataElement';
import { getDataElement } from '../../../../core/dataElement/read';
import type { IDomainConfig } from '../../../../core/domain';
import { getDomain } from '../../../../core/domain/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
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

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const TEST_NAME = 'Session lock registry - unlockAll across object types';

describe('Session lock registry (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let domainConfig: IDomainConfig | undefined;
  let dataElementConfig: IDataElementConfig | undefined;

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

      // Its OWN objects, not adt_domain's. Sharing the names meant this file
      // created ZAC_DOM01/ZAC_DTEL01 and never removed them, so Domain's and
      // DataElement's full workflows saw "already exists" and skipped — every
      // run, on every system. Two flows that never executed and still reported
      // green.
      const domainResolver = new TestConfigResolver({
        handlerName: 'create_domain',
        testCaseName: 'lock_registry_domain',
        isCloud: isCloudSystem,
        logger: testsLogger,
      });
      const dp = domainResolver.getParams();
      const domainPackage = domainResolver.getPackageName();
      if (dp?.domain_name && domainPackage) {
        domainConfig = {
          domainName: dp.domain_name,
          packageName: domainPackage,
          transportRequest: domainResolver.getTransportRequest(),
          description: dp.description,
          datatype: dp.datatype || 'CHAR',
          length: dp.length || 5,
          decimals: dp.decimals,
        };
      }

      const deResolver = new TestConfigResolver({
        handlerName: 'create_data_element',
        testCaseName: 'lock_registry_data_element',
        isCloud: isCloudSystem,
        logger: testsLogger,
      });
      const ep = deResolver.getParams();
      const dePackage = deResolver.getPackageName();
      if (ep?.data_element_name && dePackage) {
        dataElementConfig = {
          dataElementName: ep.data_element_name,
          packageName: dePackage,
          transportRequest: deResolver.getTransportRequest(),
          description: ep.description,
          typeKind: ep.type_kind || 'predefinedAbapType',
          dataType: ep.data_type || 'CHAR',
          length: ep.length,
          decimals: ep.decimals,
          shortLabel: ep.short_label,
          mediumLabel: ep.medium_label,
          longLabel: ep.long_label,
          headingLabel: ep.heading_label,
        } as IDataElementConfig;
      }

      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  it('aggregates locks from multiple handler types and unlockAll releases them all', async () => {
    logTestStart(testsLogger, TEST_NAME, {
      name: 'session_unlock_all',
      params: {
        domain_name: domainConfig?.domainName,
        data_element_name: dataElementConfig?.dataElementName,
      },
    });

    if (!hasConfig || !client || !domainConfig || !dataElementConfig) {
      logTestSkip(testsLogger, TEST_NAME, 'No SAP configuration');
      return;
    }

    try {
      // Ensure both objects exist (idempotent: create only if missing).
      try {
        await getDomain(connection, domainConfig.domainName);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          await client.getDomain().create(domainConfig);
        } else {
          throw error;
        }
      }
      try {
        await getDataElement(connection, dataElementConfig.dataElementName);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          await client.getDataElement().create(dataElementConfig);
        } else {
          throw error;
        }
      }

      // Lock both through the SAME client session — deliberately no unlock.
      await client.getDomain().lock(domainConfig);
      await client.getDataElement().lock(dataElementConfig);

      // The session-scoped registry aggregates both, regardless of type.
      expect(client.pendingLocks.length).toBe(2);

      // One call releases every dangling lock; SAP must accept them all.
      const failures = await client.unlockAll();
      expect(failures).toEqual([]);
      expect(client.pendingLocks).toEqual([]);

      logTestSuccess(testsLogger, TEST_NAME);
    } catch (error) {
      // Best-effort cleanup so a mid-test failure never leaves locks behind.
      await client.unlockAll().catch(() => {});
      logTestError(testsLogger, TEST_NAME, error);
      throw error;
    } finally {
      logTestEnd(testsLogger, TEST_NAME);
    }
  }, 900000);

  // This test needs two lockable objects and nothing more — it never activates
  // them, so what it creates is an inactive shell with no data type. Leaving
  // those behind put invalid objects in the system and, while the names were
  // shared with Domain's and DataElement's own tests, made those skip as
  // "already exists" on every run. Create-only is fine here; not cleaning up
  // was not.
  afterAll(async () => {
    if (!client) return;
    // Data element first: it may reference the domain.
    const deName = dataElementConfig?.dataElementName;
    if (deName) {
      await client
        .getDataElement()
        .delete({ dataElementName: deName })
        .catch((error: unknown) =>
          testsLogger.warn?.(
            `cleanup: ${deName} not removed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }
    const domName = domainConfig?.domainName;
    if (domName) {
      await client
        .getDomain()
        .delete({ domainName: domName })
        .catch((error: unknown) =>
          testsLogger.warn?.(
            `cleanup: ${domName} not removed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }
  }, 300000);
});
