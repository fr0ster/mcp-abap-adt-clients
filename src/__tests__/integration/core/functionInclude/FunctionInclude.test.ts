/**
 * Integration test for FunctionInclude
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - FunctionInclude library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=functionInclude/FunctionInclude
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  IFunctionIncludeConfig,
  IFunctionIncludeState,
} from '../../../../core/functionInclude';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

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

describe('FunctionInclude (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IFunctionIncludeConfig, IFunctionIncludeState>;

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

      tester = new BaseTester<IFunctionIncludeConfig, IFunctionIncludeState>(
        client.getFunctionInclude(),
        'FunctionInclude',
        'create_function_include',
        'adt_function_include',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        isLegacySystem: isLegacy,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          // package_name is not required for includes (they live in a FUGR)
          // but we still resolve it so downstream helpers can look it up.
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          const cfg: IFunctionIncludeConfig & { packageName?: string } = {
            functionGroupName: params.function_group_name,
            includeName: params.include_name,
            description: params.description,
            transportRequest,
            sourceCode: params.source_code,
            masterSystem: resolveMasterSystem(params.master_system),
            responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
          };
          if (packageName) {
            (cfg as any).packageName = packageName;
          }
          return cfg;
        },
        ensureObjectReady: async () => {
          if (!connection || !client) return { success: true };
          const testCase = tester.getTestCaseDefinition();
          const functionGroupName = testCase?.params?.function_group_name;
          const includeName = testCase?.params?.include_name;
          if (!functionGroupName || !includeName) return { success: true };

          // Probe existence of the include. readMetadata throws on 404, so we
          // catch and map status codes the same way FunctionModule does.
          try {
            await client.getFunctionInclude().readMetadata({
              functionGroupName,
              includeName,
            });
            // Include exists — let post-test cleanup handle it.
            return {
              success: false,
              objectExists: true,
              reason: `⚠️ Function Include ${functionGroupName}/${includeName} already exists. Post-test cleanup will delete it.`,
            };
          } catch (readErr: any) {
            const status = readErr?.response?.status ?? readErr?.status;
            if (status === 404) {
              return { success: true };
            }
            return {
              success: false,
              reason: `⚠️ Cannot verify Function Include ${functionGroupName}/${includeName} (HTTP ${status}): ${readErr.message}`,
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
      // Ensure the shared parent function group exists before the include test
      // runs. We mirror FunctionModule's approach: prefer the shared FUGR so a
      // single group is reused, but fall back to the default package if the
      // shared package isn't provisioned (typical on BTP trial without a
      // transport layer).
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
                  description: 'Shared FUGR for FunctionInclude tests',
                  transportRequest,
                });
              } catch (_createErr) {
                // Cloud can 404 the post-create read; retry once.
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
        const updateSourceCode =
          testCase?.params?.update_source_code || sourceCode;

        await tester.flowTestAuto({
          sourceCode,
          updateConfig: {
            functionGroupName: config.functionGroupName,
            includeName: config.includeName,
            description: `${config.description || 'Function include'} (updated)`,
            sourceCode: updateSourceCode,
          },
        });
      },
      getTimeout('test'),
    );

    it(
      'should read source via readSource()',
      async () => {
        if (!tester || !hasConfig || !client) return;
        const testCase = tester.getTestCaseDefinition();
        const functionGroupName = testCase?.params?.function_group_name;
        const includeName = testCase?.params?.include_name;
        if (!functionGroupName || !includeName) return;

        try {
          // readSource() is a method on the concrete AdtFunctionInclude handler
          // (not part of the generic IAdtObject interface), so we cast.
          const handler = client.getFunctionInclude() as unknown as {
            readSource: (
              config: Partial<IFunctionIncludeConfig>,
            ) => Promise<IFunctionIncludeState | undefined>;
          };
          const result = await handler.readSource({
            functionGroupName,
            includeName,
          });
          if (result === undefined) {
            // Include not present (e.g. previous flow test was skipped). That's
            // acceptable — the readSource path is what we're smoke-testing.
            return;
          }
          expect(result).toBeDefined();
          expect(result.errors).toEqual([]);
          const payload = result.readResult;
          const body =
            typeof payload === 'string' ? payload : (payload as any)?.data;
          expect(typeof body).toBe('string');
        } catch (error: any) {
          const status = error?.response?.status;
          if (status === 404) return; // include gone - nothing to read
          throw error;
        }
      },
      getTimeout('test'),
    );
  });
});
