/**
 * Unit test for FunctionModule locking
 * Tests lockFunctionModule function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/lock.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { lockFunctionModule } from '../../../core/functionModule/lock';
import { unlockFunctionModule } from '../../../core/functionModule/unlock';
import { getFunctionMetadata } from '../../../core/functionModule/read';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
import { registerTestLock, unregisterTestLock } from '../../helpers/lockHelper';
import { createTestLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger = createTestLogger('FunctionModule - Lock/Unlock');

const TEST_SUITE_NAME = 'FunctionModule - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let functionModuleName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    functionModuleName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      const env = await setupTestEnvironment(connection, 'functionModule_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      await (connection as any).connect();
      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_functionModule', 'test_functionModule_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        functionModuleName = null;
        return;
      }

      testCase = tc;
      functionModuleName = tc.params.function_module_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      functionModuleName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
    lockHandle = null;
  });

  // Helper function to ensure function group exists
  async function ensureFunctionGroupExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name;
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createFugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (createFugrTestCase) {
          await createFunctionGroup(connection, {
            function_group_name: functionGroupName,
            description: `Test function group for ${functionGroupName}`,
            package_name: testCase.params.package_name || createFugrTestCase.params.package_name || getDefaultPackage(),
            transport_request: createFugrTestCase.params.transport_request,
          });
          logger.debug(`Function group ${functionGroupName} created successfully`);
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
      } else {
        throw error;
      }
    }
  }
  // Helper function to ensure function module exists before test (idempotency)
  async function ensureFunctionModuleExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name;
    const functionModuleName = testCase.params.function_module_name;

    try {
      await getFunctionMetadata(connection, functionModuleName, functionGroupName);
      logger.debug(`Function module ${functionModuleName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${functionModuleName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_module', 'test_function_module');
        if (createTestCase) {
          try {
            await createFunctionModule(connection, {
              function_group_name: functionGroupName,
              function_module_name: functionModuleName,
              description: createTestCase.params.description || `Test function module for ${functionModuleName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request,
              source_code: createTestCase.params.source_code || `FUNCTION ${functionModuleName}.\nENDFUNCTION.`,
            });
            logger.debug(`Function module ${functionModuleName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create function module ${functionModuleName}: create_function_module test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock function module and get lock handle', async () => {
    if (!testCase || !functionModuleName) {
      return; // Already logged in beforeEach
    }

    await ensureFunctionGroupExists(testCase);
    await ensureFunctionModuleExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockFunctionModule(
      connection,
      functionModuleName,
      testCase.params.function_group_name,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'fm',
        functionModuleName,
        testSessionId,
        lockHandle,
        testCase.params.function_group_name,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock after test
    try {
      await unlockFunctionModule(
        connection,
        testCase.params.function_group_name,
        functionModuleName,
        lockHandle,
        testSessionId
      );

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('fm', functionModuleName, testCase.params.function_group_name);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock function module: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});

