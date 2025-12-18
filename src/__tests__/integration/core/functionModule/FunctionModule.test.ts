/**
 * Integration test for FunctionModuleBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionModuleBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionModule/FunctionModuleBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { getFunction } from '../../../../core/functionModule/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd
} from '../../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../../helpers/testLogger';
import { BaseTester } from '../../../helpers/BaseTester';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import { IFunctionModuleConfig, IFunctionModuleState } from '../../../../core/functionModule';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout
} = require('../../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}


// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('FunctionModuleBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IFunctionModuleConfig, IFunctionModuleState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getFunctionModule(),
        'FunctionModule',
        'create_function_module',
        'adt_function_module',
        testsLogger
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName = resolver?.getPackageName?.() || resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest = resolver?.getTransportRequest?.() || resolveTransportRequest(params.transport_request);
          return {
            functionGroupName: params.function_group_name,
            functionModuleName: params.function_module_name,
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code
          };
        },
        ensureObjectReady: async (functionModuleName: string) => {
          if (!connection) return { success: true };
          const testCase = tester.getTestCaseDefinition();
          const functionGroupName = testCase?.params?.function_group_name;
          if (!functionGroupName) return { success: true };
          
          // Check if function module exists
          try {
            await getFunction(connection, functionGroupName, functionModuleName);
            return { success: false, reason: `⚠️ SAFETY: Function Module ${functionGroupName}/${functionModuleName} already exists!` };
          } catch (error: any) {
            const status = error.response?.status;
            if (status !== 404 && status !== 500) {
              return { success: false, reason: `Cannot verify function module existence: ${error.message}` };
            }
          }
          return { success: true };
        }
      });
    } catch (error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  /**
   * Ensure Function Module is deleted (cleanup before test)
   */
  /**
   * Pre-check: Verify test function module doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   * Note: Can only check FM if FUGR exists. If FUGR doesn't exist, FM can't exist either.
   */
  async function ensureFunctionModuleReady(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if function module exists
    // Note: If FUGR doesn't exist, this will return 500 - that's OK, FM can't exist without FUGR
    try {
      await getFunction(connection, functionGroupName, functionModuleName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Function Module ${functionGroupName}/${functionModuleName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 or 500 are expected - object doesn't exist (or parent doesn't exist), we can proceed
      const status = error.response?.status;
      if (status !== 404 && status !== 500) {
        return {
          success: false,
          reason: `Cannot verify function module existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  /**
   * Ensure Function Group exists, create if it doesn't
   * Ignores only "already exists" errors (409)
   */
  async function ensureFunctionGroupExists(
    functionGroupName: string,
    packageName: string,
    transportRequest?: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Try to create (ignore "already exists" errors)
    try {
      const tempClient = new AdtClient(connection, builderLogger);
      await tempClient.getFunctionGroup().create({
        functionGroupName: functionGroupName,
        packageName: packageName,
        transportRequest: transportRequest,
        description: `Test function group for ${functionGroupName}`
      }, { activateOnCreate: false });
      return { success: true };
    } catch (error: any) {
      // 409 = already exists, that's fine
      if (error.response?.status === 409) {
        return { success: true };
      }
      // Other errors - return failure
      return { success: false, reason: error.message || 'Failed to create function group' };
    }
  }

  /**
   * Cleanup: delete Function Module and Function Group
   * Ignores all errors - just tries to delete
   */
  async function cleanupFunctionModuleAndGroup(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    // Delete Function Group (which automatically deletes all Function Modules inside)
    // Note: FM is already deleted in test chain if test succeeded
    try {
      const tempClient = new AdtClient(connection, builderLogger);
      // Use BaseTester's config resolver for consistent parameter resolution
      const transportRequest = tester.getTransportRequest() || undefined;
      await tempClient.getFunctionGroup().delete({
        functionGroupName: functionGroupName,
        transportRequest
      });
    } catch (error) {
      // Ignore all errors (404, locked, etc.)
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    const { getTestCaseDefinition } = require('../../../helpers/test-helper');
    return getTestCaseDefinition('create_function_module', 'adt_function_module');
  }

  describe('Full workflow', () => {
    let functionGroupCreated: boolean = false;
    let functionGroupName: string | null = null;

    beforeEach(async () => {
      // Ensure FunctionGroup exists before test
      const testCase = tester.getTestCaseDefinition();
      if (testCase?.params?.function_group_name) {
        functionGroupName = testCase.params.function_group_name;
        const packageName = resolvePackageName(testCase.params.package_name);
        if (packageName && functionGroupName) {
          const result = await ensureFunctionGroupExists(
            functionGroupName,
            packageName,
            resolveTransportRequest(testCase.params.transport_request)
          );
          functionGroupCreated = result.success;
        }
      }
      tester?.beforeEach()();
    });

    afterEach(async () => {
      tester?.afterEach()();
      // Cleanup function group if it was created in beforeEach
      if (functionGroupCreated && functionGroupName) {
        try {
          await client.getFunctionGroup().delete({
            functionGroupName: functionGroupName,
            transportRequest: resolveTransportRequest(tester.getTestCaseDefinition()?.params?.transport_request) || ''
          });
        } catch (cleanupError) {
          testsLogger.warn?.(`Cleanup failed for function group ${functionGroupName}:`, cleanupError);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      if (!hasConfig || !tester) {
        return;
      }
      const config = tester.getConfig();
      if (!config) {
        return;
      }

      const testCase = tester.getTestCaseDefinition();
      const sourceCode = testCase?.params?.source_code || config.sourceCode || '';

      await tester.flowTestAuto({
        sourceCode: sourceCode,
        updateConfig: {
          functionModuleName: config.functionModuleName,
          functionGroupName: config.functionGroupName,
          packageName: config.packageName,
          description: config.description || '',
          sourceCode: sourceCode
        }
      });
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function module', async () => {
      // Use TestConfigResolver for consistent parameter resolution
      const resolver = new TestConfigResolver({ isCloud: isCloudSystem, logger: testsLogger });
      const standardObject = resolver.getStandardObject('function_module');

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionModule - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          testsLogger,
          'FunctionModule - read standard object',
          `Standard function module not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.group || 'SYST';
      const standardFunctionModuleName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionModule - read standard object', {
        name: 'read_standard',
        params: {
          function_group_name: standardFunctionGroupName,
          function_module_name: standardFunctionModuleName
        }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionModule - read standard object', 'No SAP configuration');
        return;
      }

      try {
        const resultState = await tester.readTest({
          functionModuleName: standardFunctionModuleName,
          functionGroupName: standardFunctionGroupName
        });
        expect(resultState?.readResult).toBeDefined();
        const sourceCode = typeof resultState?.readResult === 'string' 
          ? resultState.readResult 
          : (resultState?.readResult as any)?.data || '';
        expect(typeof sourceCode).toBe('string');

        logBuilderTestSuccess(testsLogger, 'FunctionModule - read standard object');
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 404 || status === 500 || status === 403) {
          logBuilderTestSkip(
            testsLogger,
            'FunctionModule - read standard object',
            `Standard function module ${standardFunctionGroupName}/${standardFunctionModuleName} is not accessible (HTTP ${status}). This may be normal for some systems.`
          );
          return;
        }
        logBuilderTestError(testsLogger, 'FunctionModule - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionModule - read standard object');
      }
    }, getTimeout('test'));
  });
});

