/**
 * Templates for integration test files.
 *
 * Two shapes, because the tests come in two kinds:
 *
 * 1. **A bare test** — it needs a connection and nothing else. Read a standard
 *    object, probe an endpoint, check a runtime surface. First block below.
 * 2. **A CRUD-flow test for a core object type** — create, read, update,
 *    activate, delete, with cleanup and environment gating. Every test under
 *    `integration/core/` is this shape, and it is `BaseTester` that carries it.
 *    Second block below.
 *
 * The second shape used to be absent here, so each new object type was written
 * by copying whichever existing test the author happened to open. That is how
 * conventions drift: `available_in` gating gets forgotten in one file, cleanup
 * decides absence by HTTP status in another.
 *
 * In both, the connection comes from `createTestConnection()` — it takes WHERE
 * we connect and HOW we authenticate from configuration, and nothing about
 * either is written into a test.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IIncludeConfig,
  IIncludeState,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../clients/AdtClient';
import { getIncludeSource } from '../../core/include';
import { isCloudEnvironment } from '../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../helpers/testLogger';
import { BaseTester } from './BaseTester';
import { logTestSkip } from './testProgressLogger';

const {
  getEnabledTestCase,
  validateTestCaseForUserSpace,
  resolvePackageName,
  resolveTransportRequest,
} = require('./test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const libraryLogger = createLibraryLogger();
const testsLogger = createTestsLogger();

// ---------------------------------------------------------------------------
// 1. A bare test: a connection and nothing else.

describe('Module - Operation', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      // One helper, one principle: it takes WHERE we connect and HOW we
      // authenticate from the configuration, and hands back a connection that
      // is already open. Nothing about either is written into a test.
      connection = await createTestConnection(connectionLogger);
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      // Not reset(): it is gone, and it never told the server anything. This
      // releases the session instead of leaving it to time out.
      await releaseTestConnection(connection);
    }
  });

  it('should perform operation', async () => {
    if (!hasConfig) {
      testsLogger.warn(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    // Test implementation
  }, 30000);
});

// ---------------------------------------------------------------------------
// 2. A CRUD-flow test for a core object type.
//
// Worked through `IIncludeConfig` because it is the smallest real one; swap the
// four strings and the config mapping and the rest is unchanged.

describe('ObjectType (using AdtClient)', () => {
  let crudConnection: IAbapConnection;
  let client: AdtClient;
  let crudHasConfig = false;
  let isCloudSystem = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IIncludeConfig, IIncludeState>;

  beforeAll(async () => {
    try {
      crudConnection = await createTestConnection(connectionLogger);
      // Stated, never inferred from the URL or the credential.
      isCloudSystem = await isCloudEnvironment(crudConnection);
      systemContext = await resolveSystemContext(crudConnection, isCloudSystem);
      const { client: resolved } = await createTestAdtClient(
        crudConnection,
        libraryLogger,
        systemContext,
      );
      client = resolved;
      crudHasConfig = true;

      tester = new BaseTester<IIncludeConfig, IIncludeState>(
        client.getInclude(), // the handler under test
        'ObjectType', // log prefix
        'create_include', // section in test-config.yaml
        'adt_include', // test case within that section
        testsLogger,
      );

      tester.setup({
        connection: crudConnection,
        client,
        hasConfig: crudHasConfig,
        isCloudSystem,
        // Package and transport come from the resolver — never hardcoded, so
        // one config serves every system.
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          return {
            includeName: params.include_name,
            packageName,
            transportRequest:
              resolver?.getTransportRequest?.() ||
              resolveTransportRequest(params.transport_request),
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        // Idempotence: a create test deletes what a previous run left.
        //
        // Absence is told by CONTENT, not by status: `source/main` answers 200
        // with an empty body when the object is not there and never 404s, so a
        // status check decides wrongly. Measured, and it has bitten before.
        ensureObjectReady: async (name: string) => {
          if (!crudConnection) return { success: true };
          try {
            const existing = await getIncludeSource(crudConnection, name);
            if (!String(existing?.data ?? '').trim()) {
              return { success: true };
            }
            const { client: cleanupClient } = await createTestAdtClient(
              crudConnection,
              libraryLogger,
              systemContext,
            );
            await cleanupClient.getInclude().delete({
              includeName: name,
              transportRequest: tester.getTransportRequest(),
            });
            await new Promise((resolve) => setTimeout(resolve, 3000));
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify ${name}: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (error) {
      crudHasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it('should run the full workflow', async () => {
      if (!tester) return;
      if (!crudHasConfig) {
        await tester.flowTestAuto();
        return;
      }

      // Gate on the CAPABILITY and name it. A skip that says "not supported"
      // without saying why is how a gap stays invisible — say what the system
      // lacks, so a reader can check whether it is still true.
      if (isCloudSystem) {
        logTestSkip(
          testsLogger,
          'ObjectType - full workflow',
          'the collection declares no app:accept on this system, so it is not a creation target',
        );
        return;
      }

      const config = tester.getConfig();
      if (!config) {
        await tester.flowTestAuto();
        return;
      }

      const testCase = tester.getTestCaseDefinition();
      const sourceCode =
        testCase?.params?.source_code || config.sourceCode || '';

      await tester.flowTestAuto({
        sourceCode,
        updateConfig: {
          ...config,
          sourceCode: testCase?.params?.update_source_code || sourceCode,
        },
      });
    }, 900000);
  });
});
