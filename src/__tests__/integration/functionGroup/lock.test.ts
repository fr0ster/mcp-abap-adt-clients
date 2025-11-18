/**
 * Unit test for FunctionGroup locking
 * Tests lockFunctionGroup function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionGroup/lock.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { lockFunctionGroup } from '../../../core/functionGroup/lock';
import { unlockFunctionGroup } from '../../../core/functionGroup/lock';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
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

const logger = createTestLogger('FunctionGroup - Lock/Unlock');

const TEST_SUITE_NAME = 'FunctionGroup - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let functionGroupName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    functionGroupName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }
    lockHandle = null; // Reset lock handle for each test
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking
      const env = await setupTestEnvironment(connection, 'functiongroup_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      // Connect to SAP system (triggers auth & auto-refresh)
      await (connection as any).connect();

      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_functionGroup', 'test_functionGroup_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        functionGroupName = null;
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      functionGroupName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
    lockHandle = null; // Clean up lock handle
  });

  // Helper function to ensure object exists before test (idempotency)
  async function ensureFunctionGroupExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name;

    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (createTestCase) {
          try {
            await createFunctionGroup(connection, {
              function_group_name: functionGroupName,
              description: createTestCase.params.description || `Test function group for ${functionGroupName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request,
            });
            logger.debug(`Function group ${functionGroupName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock function group and get lock handle', async () => {
    if (!testCase || !functionGroupName) {
      return; // Already logged in beforeEach
    }

    await ensureFunctionGroupExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockFunctionGroup(
      connection,
      functionGroupName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Note: Function groups don't have a dedicated object type in lock registry
    // They're containers, not standalone objects like classes/programs
    // Lock registration skipped intentionally

    // Unlock after test
    try {
      await unlockFunctionGroup(connection, functionGroupName, lockHandle, testSessionId);
      logger.debug(`✓ Function group unlocked successfully`);
    } catch (error) {
      logger.error(`Failed to unlock function group: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
