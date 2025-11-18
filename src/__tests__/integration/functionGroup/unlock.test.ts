/**
 * Integration test for FunctionGroup unlock
 * Tests unlockFunctionGroup function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionGroup/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockFunctionGroup, unlockFunctionGroup } from '../../../core/functionGroup/lock';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'FunctionGroup - Unlock';
const logger = createTestLogger('FG-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
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
    functionGroupName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'functionGroup_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_function_group');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    functionGroupName = tc.params.function_group_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure function group exists before test
   */
  async function ensureFunctionGroupExists(testCase: any): Promise<void> {
    const fgName = testCase.params.function_group_name;

    try {
      await getFunctionGroup(connection, fgName);
      logger.debug(`Function group ${fgName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${fgName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!createTestCase) {
          throw new Error(`Cannot create function group ${fgName}: create_function_group test case not found`);
        }

        await createFunctionGroup(connection, {
          function_group_name: fgName,
          description: createTestCase.params.description || `Test function group for ${fgName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request,
        });
        logger.debug(`Function group ${fgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock function group', async () => {
    // Skip if no test case configured
    if (!testCase || !functionGroupName) {
      logger.skip('Unlock Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for function group: ${functionGroupName}`);

    try {
      // Ensure function group exists
      await ensureFunctionGroupExists(testCase);

      // Lock function group first
      const lockHandle = await lockFunctionGroup(connection, functionGroupName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock function group
      await unlockFunctionGroup(connection, functionGroupName, lockHandle, sessionId || '');
      logger.info(`✓ Function group ${functionGroupName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock function group: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
