/**
 * Integration test for FunctionModule
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - FunctionModule library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=functionModule/FunctionModule
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  IFunctionModuleConfig,
  IFunctionModuleState,
} from '../../../../core/functionModule';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
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
  resolvePackageName,
  resolveTransportRequest,
  resolveMasterSystem,
  getTimeout,
  ensureSharedPackage,
  ensureSharedDependency,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('FunctionModule (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IFunctionModuleConfig, IFunctionModuleState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      tester = new BaseTester(
        client.getFunctionModule(),
        'FunctionModule',
        'create_function_module',
        'adt_function_module',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            functionGroupName: params.function_group_name,
            functionModuleName: params.function_module_name,
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
            masterSystem: resolveMasterSystem(params.master_system),
            responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
          };
        },
        ensureObjectReady: async (functionModuleName: string) => {
          if (!connection || !client) return { success: true };
          const testCase = tester.getTestCaseDefinition();
          const functionGroupName = testCase?.params?.function_group_name;
          if (!functionGroupName) return { success: true };

          // Check if function module already exists via metadata
          try {
            await client.getFunctionModule().readMetadata({
              functionGroupName,
              functionModuleName,
            });
            // FM exists — skip test, post-test cleanup will handle deletion
            return {
              success: false,
              objectExists: true,
              reason: `⚠️ Function Module ${functionGroupName}/${functionModuleName} already exists. Post-test cleanup will delete it.`,
            };
          } catch (readErr: any) {
            const status = readErr?.response?.status ?? readErr?.status;
            if (status === 404) {
              // FM doesn't exist — safe to proceed
              return { success: true };
            }
            // Other error (406, 500, etc.) — cannot determine existence, skip for safety
            return {
              success: false,
              reason: `⚠️ Cannot verify FM ${functionGroupName}/${functionModuleName} (HTTP ${status}): ${readErr.message}`,
            };
          }
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(async () => {
      // Ensure the shared function group exists (created once, never deleted)
      if (hasConfig && client) {
        const testCase = tester.getTestCaseDefinition();
        const functionGroupName = testCase?.params?.function_group_name;
        if (functionGroupName) {
          try {
            await ensureSharedPackage(client, testsLogger);
            await ensureSharedDependency(
              client,
              'function_groups',
              functionGroupName,
              testsLogger,
            );
          } catch (_sharedError) {
            // Shared package unavailable (e.g. BTP trial without transport layer) —
            // fall back to creating the function group in the default package
            const packageName = resolvePackageName(
              testCase?.params?.package_name,
            );
            const transportRequest = resolveTransportRequest(
              testCase?.params?.transport_request,
            );
            const readResult = await client
              .getFunctionGroup()
              .read({ functionGroupName });
            if (readResult) {
              testsLogger.info?.(
                `Function group ${functionGroupName} already exists`,
              );
            } else {
              try {
                await client.getFunctionGroup().create({
                  functionGroupName,
                  packageName,
                  description: 'Shared FUGR for FM tests',
                  transportRequest,
                });
              } catch (_createErr) {
                // On cloud, the HTTP create may succeed but the post-create read
                // fails (404) due to eventual consistency. Wait and verify.
                await new Promise((r) => setTimeout(r, 5000));
                const verify = await client
                  .getFunctionGroup()
                  .read({ functionGroupName });
                if (!verify) throw _createErr;
              }
              testsLogger.info?.(
                `Created function group ${functionGroupName} in ${packageName}`,
              );
            }
          }
        }
      }
      await tester?.beforeEach()();
    });

    afterEach(() => {
      tester?.afterEach()();
    });

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
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
          sourceCode: sourceCode,
          updateConfig: {
            functionModuleName: config.functionModuleName,
            functionGroupName: config.functionGroupName,
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP function module',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('function_module');

        if (!standardObject) {
          logTestStart(testsLogger, 'FunctionModule - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'FunctionModule - read standard object',
            `Standard function module not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const standardFunctionGroupName = standardObject.group || 'SYST';
        const standardFunctionModuleName = standardObject.name;
        logTestStart(testsLogger, 'FunctionModule - read standard object', {
          name: 'read_standard',
          params: {
            function_group_name: standardFunctionGroupName,
            function_module_name: standardFunctionModuleName,
          },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'FunctionModule - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            functionModuleName: standardFunctionModuleName,
            functionGroupName: standardFunctionGroupName,
          });
          expect(resultState?.readResult).toBeDefined();
          const sourceCode =
            typeof resultState?.readResult === 'string'
              ? resultState.readResult
              : (resultState?.readResult as any)?.data || '';
          expect(typeof sourceCode).toBe('string');

          logTestSuccess(testsLogger, 'FunctionModule - read standard object');
        } catch (error: any) {
          const status = error.response?.status;
          if (status === 404 || status === 500 || status === 403) {
            logTestSkip(
              testsLogger,
              'FunctionModule - read standard object',
              `Standard function module ${standardFunctionGroupName}/${standardFunctionModuleName} is not accessible (HTTP ${status}). This may be normal for some systems.`,
            );
            return;
          }
          logTestError(
            testsLogger,
            'FunctionModule - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'FunctionModule - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});
