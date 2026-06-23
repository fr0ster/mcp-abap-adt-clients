/**
 * Integration test for ScalarFunction (CDS DSFD/SCF)
 * Tests using AdtClient for unified CRUD operations.
 *
 * The test uses a discovery-then-create skip gate: if the DSFD endpoint is
 * absent on the target system (HTTP 404/405/501) the suite is skipped;
 * all other errors are rethrown and fail the test as real issues.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ScalarFunction library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=scalarFunction/ScalarFunction
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
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

const {
  getEnabledTestCase,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/** HTTP status codes that indicate the DSFD feature is absent on this system. */
const SKIP_STATUSES = new Set([404, 405, 501]);

describe('ScalarFunction (DSFD/SCF) integration', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
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
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
    }
  });

  describe('Full workflow', () => {
    it(
      'create → read → update → activate → delete (skips only on 404/405/501)',
      async () => {
        const TEST_LABEL = 'ScalarFunction - full workflow';

        // Resolve test-case params from test-config.yaml (key: create_scalar_function)
        const testCase = getEnabledTestCase(
          'create_scalar_function',
          'adt_scalar_function',
        );

        // Determine object name and package from config or defaults
        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });

        const scalarFunctionName: string =
          testCase?.params?.scalar_function_name ?? 'ZADT_SCALAR_FUNC';

        const packageName: string | null =
          resolver.getPackageName() ||
          resolvePackageName(testCase?.params?.package_name);

        logTestStart(testsLogger, TEST_LABEL, {
          name: scalarFunctionName,
          params: { package_name: packageName },
        });

        if (!hasConfig) {
          logTestSkip(testsLogger, TEST_LABEL, 'No SAP configuration');
          return;
        }

        if (!packageName) {
          logTestSkip(
            testsLogger,
            TEST_LABEL,
            'package_name not configured — set environment.default_package in test-config.yaml',
          );
          return;
        }

        const transportRequest: string | undefined = resolveTransportRequest(
          testCase?.params?.transport_request,
        );

        const sf = client.getScalarFunction();

        // ── 1) Idempotent cleanup of any leftover object from a previous run ──
        try {
          await sf.delete({
            scalarFunctionName,
            transportRequest,
          });
        } catch {
          // Ignore — object may not exist yet
        }

        // ── 2) Create (also confirms DSFD is supported on this system) ──
        try {
          await sf.create({
            scalarFunctionName,
            packageName,
            transportRequest,
            description: 'ADT integration test scalar function',
          });
        } catch (createError) {
          const status = (createError as { response?: { status?: number } })
            .response?.status;
          if (status && SKIP_STATUSES.has(status)) {
            logTestSkip(
              testsLogger,
              TEST_LABEL,
              `DSFD unsupported on this system (HTTP ${status})`,
            );
            return;
          }
          logTestError(testsLogger, TEST_LABEL, createError);
          throw createError;
        }

        try {
          // A CDS scalar function can only ACTIVATE when its source is backed by an
          // AMDP method (`CLASS-METHODS ... FOR SCALAR FUNCTION ... BY DATABASE
          // FUNCTION FOR HDB LANGUAGE SQLSCRIPT`) that exists on the target system —
          // an environment-specific fixture. So the update/activate flow runs ONLY
          // when a valid `source_code` is configured in
          // create_scalar_function.params.source_code (and the companion AMDP class
          // is deployed). Otherwise we validate the DSFD wire contract via
          // create → read → delete, which needs no AMDP fixture.
          const configuredSource: string | undefined =
            testCase?.params?.source_code;

          if (configuredSource) {
            // ── 3a) Full flow: update source + activate ──
            await sf.update(
              {
                scalarFunctionName,
                transportRequest,
                sourceCode: configuredSource,
              },
              { activateOnUpdate: true },
            );

            // ── 4a) Read active ──
            const readState = await sf.read({ scalarFunctionName }, 'active');
            expect(readState).toBeDefined();
            expect(readState?.readResult).toBeDefined();
            expect((readState?.readResult as any)?.status).toBe(200);
          } else {
            // ── 3b) Metadata-only validation: read the inactive object back ──
            const readState = await sf.read({ scalarFunctionName }, 'inactive');
            expect(readState).toBeDefined();
            expect(readState?.readResult).toBeDefined();
            expect((readState?.readResult as any)?.status).toBe(200);
          }

          // ── 5) Delete ──
          const deleteState = await sf.delete({
            scalarFunctionName,
            transportRequest,
          });
          expect(deleteState.deleteResult).toBeDefined();

          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          // Best-effort cleanup
          try {
            await sf.delete({ scalarFunctionName, transportRequest });
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        } finally {
          logTestEnd(testsLogger, TEST_LABEL);
        }
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard scalar function (if configured)',
      async () => {
        const TEST_LABEL = 'ScalarFunction - read standard object';

        const {
          getTestCaseDefinition,
        } = require('../../../helpers/test-helper');
        const testCase = getTestCaseDefinition(
          'read_scalar_function',
          'read_standard_scalar_function',
        );

        if (!testCase) {
          logTestStart(testsLogger, TEST_LABEL, {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            TEST_LABEL,
            'Test case not defined in test-config.yaml',
          );
          return;
        }

        const scalarFunctionName: string | undefined =
          testCase.params?.scalar_function_name;

        if (!scalarFunctionName) {
          logTestStart(testsLogger, TEST_LABEL, {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            TEST_LABEL,
            'scalar_function_name not configured',
          );
          return;
        }

        logTestStart(testsLogger, TEST_LABEL, {
          name: scalarFunctionName,
          params: { scalar_function_name: scalarFunctionName },
        });

        if (!hasConfig) {
          logTestSkip(testsLogger, TEST_LABEL, 'No SAP configuration');
          return;
        }

        try {
          const sf = client.getScalarFunction();
          const resultState = await sf.read({ scalarFunctionName }, 'active');
          if (!resultState) {
            logTestSkip(
              testsLogger,
              TEST_LABEL,
              `Scalar function ${scalarFunctionName} not found in system`,
            );
            return;
          }
          expect(resultState.readResult).toBeDefined();
          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, TEST_LABEL);
        }
      },
      getTimeout('test'),
    );
  });
});
