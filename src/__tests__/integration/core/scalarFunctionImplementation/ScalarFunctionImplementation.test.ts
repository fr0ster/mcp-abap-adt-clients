/**
 * Integration test for ScalarFunctionImplementation (CDS DSFI/SFI)
 * Tests using AdtClient for unified CRUD operations.
 *
 * The suite requires BOTH source params in test-config.yaml:
 *   - scalar_function_source_code: DSFD signature (inactive, no activate required)
 *   - source_code: DSFI sqlEngine body
 * Without either, the WHOLE suite is skipped (no downgrade to create-only).
 *
 * The test probes the DSFI endpoint via create; on HTTP 404/405/501 the suite
 * is skipped — DSFI is only available on systems that support the CDS DSFI feature.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ScalarFunctionImplementation library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=scalarFunctionImplementation/ScalarFunctionImplementation
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

/** HTTP status codes that indicate the DSFI feature is absent on this system. */
const SKIP_STATUSES = new Set([404, 405, 501]);

describe('ScalarFunctionImplementation (DSFI/SFI) integration', () => {
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
      'companion DSFD signature → DSFI create → update → read → readMetadata → delete',
      async () => {
        const TEST_LABEL = 'ScalarFunctionImplementation - full workflow';

        // Resolve test-case params from test-config.yaml
        const testCase = getEnabledTestCase(
          'create_scalar_function_implementation',
          'adt_scalar_function_implementation',
        );

        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });

        const sigSource: string | undefined =
          testCase?.params?.scalar_function_source_code;
        const implSource: string | undefined = testCase?.params?.source_code;

        const implName: string =
          testCase?.params?.implementation_name ?? 'ZADT_SCALAR_FUNC_SQL';
        const funcName: string =
          testCase?.params?.scalar_function_name ?? 'ZADT_SCALAR_FUNC';
        const packageName: string | null =
          resolver.getPackageName() ||
          resolvePackageName(testCase?.params?.package_name);
        const transportRequest: string | undefined = resolveTransportRequest(
          testCase?.params?.transport_request,
        );

        logTestStart(testsLogger, TEST_LABEL, {
          name: implName,
          params: {
            implementation_name: implName,
            scalar_function_name: funcName,
            package_name: packageName,
          },
        });

        if (!hasConfig) {
          logTestSkip(testsLogger, TEST_LABEL, 'No SAP configuration');
          return;
        }

        // REQUIRED-source gate: without BOTH sources the whole suite skips (no downgrade).
        if (!sigSource || !implSource) {
          logTestSkip(
            testsLogger,
            TEST_LABEL,
            'requires scalar_function_source_code + source_code in test-config.yaml',
          );
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

        const sf = client.getScalarFunction();
        const dsfi = client.getScalarFunctionImplementation();

        // ── 1) Idempotent cleanup of any leftover objects from a previous run ──
        try {
          await dsfi.delete({ implementationName: implName });
        } catch {
          // Ignore — object may not exist yet
        }
        try {
          await sf.delete({ scalarFunctionName: funcName, transportRequest });
        } catch {
          // Ignore — object may not exist yet
        }

        try {
          // ── 2) Create companion DSFD ──
          try {
            await sf.create({
              scalarFunctionName: funcName,
              packageName,
              transportRequest,
              description: 'companion DSFD for DSFI integration test',
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

          // ── 3) Write DSFD signature via low-level lock→update→unlock (inactive, no activate) ──
          // The DSFI check requires the companion DSFD to have a signature defined.
          // We bypass the full update() chain to avoid activation (no AMDP required).
          const sfLock = await sf.lock({ scalarFunctionName: funcName });
          await sf.update(
            { scalarFunctionName: funcName, transportRequest },
            { lockHandle: sfLock, sourceCode: sigSource },
          );
          await sf.unlock({ scalarFunctionName: funcName }, sfLock);

          // ── 4) Create DSFI ──
          try {
            await dsfi.create({
              implementationName: implName,
              scalarFunctionName: funcName,
              engineValue: 'sqlEngine',
              packageName,
              transportRequest,
              description: 'AdtScalarFunctionImplementation integration test',
            });
          } catch (createError) {
            const status = (createError as { response?: { status?: number } })
              .response?.status;
            if (status && SKIP_STATUSES.has(status)) {
              logTestSkip(
                testsLogger,
                TEST_LABEL,
                `DSFI unsupported on this system (HTTP ${status})`,
              );
              // Best-effort cleanup of companion DSFD
              try {
                await sf.delete({
                  scalarFunctionName: funcName,
                  transportRequest,
                });
              } catch {
                // Ignore cleanup errors
              }
              return;
            }
            logTestError(testsLogger, TEST_LABEL, createError);
            throw createError;
          }

          // ── 5) Update DSFI source (exercises full lock→check→update→unlock→check chain) ──
          await dsfi.update({
            implementationName: implName,
            sourceCode: implSource,
            transportRequest,
          });

          // ── 6) Read DSFI source (inactive version) ──
          const readState = await dsfi.read(
            { implementationName: implName },
            'inactive',
          );
          expect(readState).toBeDefined();
          expect(readState?.readResult).toBeDefined();

          // ── 7) Read DSFI metadata ──
          const metaState = await dsfi.readMetadata({
            implementationName: implName,
          });
          expect(metaState.metadataResult).toBeDefined();

          // ── 8) Delete DSFI then companion DSFD ──
          const deleteImplState = await dsfi.delete({
            implementationName: implName,
            transportRequest,
          });
          expect(deleteImplState.deleteResult).toBeDefined();

          await sf.delete({ scalarFunctionName: funcName, transportRequest });

          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          // Best-effort cleanup (impl first, then companion DSFD)
          try {
            await dsfi.delete({ implementationName: implName });
          } catch {
            // Ignore cleanup errors
          }
          try {
            await sf.delete({ scalarFunctionName: funcName, transportRequest });
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
});
