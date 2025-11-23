/**
 * Unit test for FunctionModuleBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_E2E_TESTS=true   - E2E test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionModuleBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionModule/FunctionModuleBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionModuleBuilder } from '../../../core/functionModule';
import { IAdtLogger } from '../../../utils/logger';
import { FunctionGroupBuilder } from '../../../core/functionGroup';
import { getFunction } from '../../../core/functionModule/read';
import { deleteFunctionGroup } from '../../../core/functionGroup/delete';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import { createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getOperationDelay
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}


// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('FunctionModuleBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

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
      const builder = new FunctionGroupBuilder(connection, {}, {
        functionGroupName: functionGroupName,
        packageName: packageName,
        transportRequest: transportRequest,
        description: `Test function group for ${functionGroupName}`
      });
      await builder.create();
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
      await deleteFunctionGroup(connection, {
        function_group_name: functionGroupName,
        transport_request: resolveTransportRequest(undefined) || undefined
      });
    } catch (error) {
      // Ignore all errors (404, locked, etc.)
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_function_module', 'builder_function_module');
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let functionGroupName: string | null = null;
    let functionModuleName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      functionGroupName = null;
      functionModuleName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'FunctionModuleBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
      functionModuleName = tc.params.function_module_name;

      // Cleanup before test: delete Function Module if exists
      if (functionGroupName && functionModuleName) {
        const cleanup = await ensureFunctionModuleReady(functionGroupName, functionModuleName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup Function Module before test';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
          return;
        }
      }

      // Ensure Function Group exists before test
      if (functionGroupName) {
        const packageName = resolvePackageName(tc.params.package_name);
        const transportRequest = resolveTransportRequest(tc.params.transport_request);
        const setup = await ensureFunctionGroupExists(functionGroupName, packageName, transportRequest);
        if (!setup.success) {
          skipReason = setup.reason || 'Failed to setup Function Group';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName || !functionModuleName) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      let builder: FunctionModuleBuilder | null = null;
      try {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (!packageName) {
          logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', 'package_name not configured');
          return;
        }
        builder = new FunctionModuleBuilder(connection, builderLogger, {
          functionGroupName,
          functionModuleName,
          sourceCode: testCase.params.source_code,
          packageName,
          transportRequest: resolveTransportRequest(testCase.params.transport_request),
          description: testCase.params.description,
          onLock: createOnLockCallback('fm', functionModuleName, functionGroupName, __filename)
        });
        
        const sourceCode = testCase.params.source_code;
        
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(async b => {
            // Wait for SAP to commit create operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(async b => {
            // Wait for SAP to commit lock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
            logBuilderTestStep('check with source code (before update)');
            return b.check('inactive', sourceCode);
          })
          .then(b => {
            logBuilderTestStep('update');
            return b.update();
          })
          .then(async b => {
            // Wait for SAP to commit update operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
            logBuilderTestStep('check');
            return b.check();
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
        })
          .then(async b => {
            // Wait for SAP to commit unlock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
            logBuilderTestStep('activate');
            return b.activate();
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup FM)');
            return b.delete();
          });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(testsLogger, 'FunctionModuleBuilder - full workflow');
      } catch (error: any) {
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // "Already exists" errors should fail the test (cleanup must work)
        logBuilderTestError(testsLogger, 'FunctionModuleBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock and delete Function Group (which also deletes all FMs inside)
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        await cleanupFunctionModuleAndGroup(functionGroupName!, functionModuleName!).catch(() => {
          logBuilderTestError(testsLogger, 'FunctionModuleBuilder - full workflow', new Error('Cleanup failed'));
        });
        logBuilderTestEnd(testsLogger, 'FunctionModuleBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function module', async () => {
      const testCase = getTestCaseDefinition('create_function_module', 'builder_function_module');
      const standardObject = resolveStandardObject('function_module', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'FunctionModuleBuilder - read standard object',
          `Standard function module not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.group || 'SYST';
      const standardFunctionModuleName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - read standard object', {
        name: 'read_standard',
        params: {
          function_group_name: standardFunctionGroupName,
          function_module_name: standardFunctionModuleName
        }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: standardFunctionGroupName,
        functionModuleName: standardFunctionModuleName,
        description: '', // Not used for read operations
        sourceCode: '' // Not needed for read
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'FunctionModuleBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'FunctionModuleBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionModuleBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

