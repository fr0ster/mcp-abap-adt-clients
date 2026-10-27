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
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { IFunctionModuleConfig } from '../../../../core/functionModule';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { gate, gateStandardObject } from '../../../helpers/caseGate';
import { ensureFunctionGroupFor } from '../../../helpers/functionGroupRoute';
import { presenceOf } from '../../../helpers/objectPresence';
import {
  createTestAdtClient,
  createTestConnection,
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
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  resolveMasterSystem,
  getTimeout,
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
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IFunctionModuleConfig>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
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
            source: params.source_code,
            masterSystem: resolveMasterSystem(params.master_system),
            responsible: process.env.SAP_USERNAME || process.env.SAP_USER,
          };
        },
        ensureObjectReady: async (functionModuleName: string) => {
          if (!connection || !client) return { success: true };
          const testCase = tester.getTestCaseDefinition();
          const functionGroupName = testCase?.params?.function_group_name;
          if (!functionGroupName) return { success: true };

          // The answer decides, not the absence of a throw: a read does not
          // throw for a missing object any more, so the old `try` fell through
          // to "it exists" every time and this flow refused to run against a
          // system that was in exactly the state it wanted.
          const presence = presenceOf(
            await client.getFunctionModule().readMetadata(
              {
                functionGroupName,
                functionModuleName,
              },
              { analyse: analyseException },
            ),
            `FM ${functionGroupName}/${functionModuleName}`,
          );
          if (presence.present === 'unknown') {
            // Not "missing": we did not find out, and creating over an object
            // that may be there is the irreversible half of that guess.
            return { success: false, reason: `⚠️ ${presence.reason}` };
          }
          if (presence.present) {
            return {
              success: false,
              objectExists: true,
              reason: `⚠️ Function Module ${functionGroupName}/${functionModuleName} already exists — this run is removing it, so the next one starts clean. Nothing was verified here.`,
            };
          }
          return { success: true };
        },
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(async () => {
      // The function group the module goes into, by the route the case
      // states (`params.function_group_route`); a failure of that route fails
      // the test — the other route is never a recovery from it.
      if (hasConfig && client) {
        const params = tester.getTestCaseDefinition()?.params;
        if (params) {
          await ensureFunctionGroupFor(
            client,
            params,
            'create_function_module[adt_function_module]',
            'Shared FUGR for FM tests',
            testsLogger,
          );
        }
      }
      await tester?.beforeEach()();
    });

    afterEach(() => {
      tester?.afterEach()();
    });

    gate('create_function_module', 'adt_function_module')(
      'should execute full workflow and store all results',
      async () => {
        const config = await tester.requireConfig();

        const testCase = tester.getTestCaseDefinition();
        const sourceCode = testCase?.params?.source_code || config.source || '';

        await tester.flowTestAuto({
          source: sourceCode,
          updateConfig: {
            functionModuleName: config.functionModuleName,
            functionGroupName: config.functionGroupName,
            description: config.description || '',
            source: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    gateStandardObject('function_module')(
      'should read standard SAP function module',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('function_module');

        if (!standardObject) {
          throw new Error(
            `Standard function module not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
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

        try {
          const resultState = await tester.readTest({
            functionModuleName: standardFunctionModuleName,
            functionGroupName: standardFunctionGroupName,
          });
          // `readTest` unwraps the contract, so this is the document itself —
          // the `.data` fallback beside it was reaching into an envelope that
          // no longer arrives.
          expect(typeof resultState).toBe('string');

          logTestSuccess(testsLogger, 'FunctionModule - read standard object');
        } catch (error: any) {
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
