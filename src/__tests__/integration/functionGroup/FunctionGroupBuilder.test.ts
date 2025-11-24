/**
 * Unit test for FunctionGroupBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionGroupBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionGroup/FunctionGroupBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionGroupBuilder } from '../../../core/functionGroup';
import { IAdtLogger } from '../../../utils/logger';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  setTotalTests,
  resetTestCounter
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

describe('FunctionGroupBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);

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
    resetTestCounter();
    if (connection) {
      connection.reset();
    }
  });

  /**
   * Pre-check: Verify test function group doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureFunctionGroupReady(functionGroupName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if function group exists
    try {
      await getFunctionGroup(connection, functionGroupName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Function Group ${functionGroupName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify function group existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_function_group', 'builder_function_group');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for FunctionGroupBuilder test');
    }
    return {
      functionGroupName: params.function_group_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let functionGroupName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      functionGroupName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_function_group', 'builder_function_group');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'FunctionGroupBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;

      // Cleanup before test
      if (functionGroupName) {
        const cleanup = await ensureFunctionGroupReady(functionGroupName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup function group before test';
        testCase = null;
        functionGroupName = null;
      }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new FunctionGroupBuilder(connection, builderLogger, buildBuilderConfig(testCase));

      try {
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
            logBuilderTestStep('check');
            return b.check();
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
          });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(testsLogger, 'FunctionGroupBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(testsLogger, 'FunctionGroupBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(testsLogger, 'FunctionGroupBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function group', async () => {
      const testCase = getTestCaseDefinition('create_function_group', 'builder_function_group');
      const standardObject = resolveStandardObject('function_group', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'FunctionGroupBuilder - read standard object',
          `Standard function group not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
        name: 'read_standard',
        params: { function_group_name: standardFunctionGroupName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new FunctionGroupBuilder(connection, builderLogger, {
        functionGroupName: standardFunctionGroupName,
        packageName: 'SAP', // Standard package
        description: '' // Not used for read operations
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'FunctionGroupBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'FunctionGroupBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionGroupBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});
