/**
 * Integration test for FunctionModule unlock
 * Tests unlockFunctionModule function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionModule/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockFunctionModule } from '../../../core/functionModule/lock';
import { unlockFunctionModule } from '../../../core/functionModule/unlock';
import { getFunctionMetadata } from '../../../core/functionModule/read';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'FunctionModule - Unlock';
const logger = createTestLogger('FM-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let functionModuleName: string | null = null;
  let functionGroupName: string | null = null;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await (connection as any).connect();
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    // Reset suite variables
    testCase = null;
    functionModuleName = null;
    functionGroupName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'functionModule_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_function_module');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    functionModuleName = tc.params.function_module_name;
    functionGroupName = tc.params.function_group_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure function group exists
   */
  async function ensureFunctionGroupExists(functionGroupName: string, packageName?: string): Promise<void> {
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createFugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!createFugrTestCase) {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }

        await createFunctionGroup(connection, {
          function_group_name: functionGroupName,
          description: `Test function group for ${functionGroupName}`,
          package_name: packageName || createFugrTestCase.params.package_name || getDefaultPackage(),
          transport_request: createFugrTestCase.params.transport_request,
        });
        logger.debug(`Function group ${functionGroupName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Ensure function module exists before test
   */
  async function ensureFunctionModuleExists(testCase: any): Promise<void> {
    const fgName = testCase.params.function_group_name;
    const fmName = testCase.params.function_module_name;

    try {
      await getFunctionMetadata(connection, fmName, fgName);
      logger.debug(`Function module ${fmName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${fmName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_module', 'test_function_module');
        if (!createTestCase) {
          throw new Error(`Cannot create function module ${fmName}: create_function_module test case not found`);
        }

        await createFunctionModule(connection, {
          function_group_name: fgName,
          function_module_name: fmName,
          description: createTestCase.params.description || `Test function module for ${fmName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request,
          source_code: createTestCase.params.source_code || `FUNCTION ${fmName}.\nENDFUNCTION.`,
        });
        logger.debug(`Function module ${fmName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock function module', async () => {
    // Skip if no test case configured
    if (!testCase || !functionModuleName || !functionGroupName) {
      logger.skip('Unlock Test', testCase ? 'Function module/group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for function module: ${functionModuleName}`);

    try {
      // Ensure function module exists
      await ensureFunctionModuleExists(testCase);

      // Lock function module first
      const lockHandle = await lockFunctionModule(connection, functionGroupName, functionModuleName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock function module
      await unlockFunctionModule(connection, functionGroupName, functionModuleName, lockHandle, sessionId || '');
      logger.info(`✓ Function module ${functionModuleName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock function module: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
