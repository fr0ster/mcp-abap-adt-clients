/**
 * Integration test for FunctionGroup update
 * Tests updateFunctionGroup function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionGroup/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateFunctionGroup } from '../../../core/functionGroup/update';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'FunctionGroup - Update';
const logger = createTestLogger('FG-UPDATE');

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
    const env = await setupTestEnvironment(connection, 'functionGroup_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('update_functionGroup', 'test_functionGroup');
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
   * Ensure function group exists before update
   */
  async function ensureFunctionGroupExists(testCase: any): Promise<void> {
    const fgName = testCase.params.function_group_name;

    try {
      await getFunctionGroup(connection, fgName);
      logger.debug(`Function group ${fgName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404 || error.message?.includes('not found')) {
        logger.debug(`Function group ${fgName} does not exist, creating...`);

        const createTestCase = getEnabledTestCase('create_functionGroup', 'test_functionGroup');
        if (!createTestCase) {
          throw new Error(`Cannot create function group ${fgName}: create_functionGroup test case not found`);
        }

        await createFunctionGroup(connection, {
          function_group_name: fgName,
          description: createTestCase.params.description || `Test FG for ${fgName}`,
          package_name: createTestCase.params.package_name,
          transport_request: createTestCase.params.transport_request,
          activate: true
        });
        logger.debug(`Function group ${fgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update function group metadata (description)', async () => {
    // Skip if no test case configured
    if (!testCase || !functionGroupName) {
      logger.skip('Update Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for function group: ${functionGroupName}`);

    try {
      // Ensure function group exists
      await ensureFunctionGroupExists(testCase);

      // Prepare updated description
      const updatedDescription = testCase.params.updated_description ||
        `Updated description for ${functionGroupName} at ${new Date().toISOString()}`;

      logger.debug(`Updating description to: "${updatedDescription}"`);

      // Update function group metadata
      const result = await updateFunctionGroup(connection, {
        function_group_name: functionGroupName,
        description: updatedDescription,
        transport_request: testCase.params.transport_request
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(200);

      logger.info(`✓ Function group ${functionGroupName} updated successfully`);

      // Verify update by reading back
      const verifyResponse = await getFunctionGroup(connection, functionGroupName);
      expect(verifyResponse.data).toBeDefined();

      // Parse and check description
      const responseData = typeof verifyResponse.data === 'string'
        ? verifyResponse.data
        : JSON.stringify(verifyResponse.data);

      expect(responseData).toContain(updatedDescription);
      logger.debug(`✓ Verified: Description updated to "${updatedDescription}"`);

    } catch (error: any) {
      logger.error(`✗ Failed to update function group: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should update function group with existing lock handle', async () => {
    // Skip if no test case configured
    if (!testCase || !functionGroupName) {
      logger.skip('Update with Lock Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update with lock handle for: ${functionGroupName}`);

    try {
      // Import lock/unlock functions
      const { lockFunctionGroup } = require('../../../core/functionGroup/lock');
      const { unlockFunctionGroup } = require('../../../core/functionGroup/unlock');

      // Ensure function group exists
      await ensureFunctionGroupExists(testCase);

      // Acquire lock manually
      const lockHandle = await lockFunctionGroup(connection, functionGroupName, sessionId || '');
      expect(lockHandle).toBeDefined();
      expect(typeof lockHandle).toBe('string');
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Prepare updated description
      const updatedDescription = testCase.params.updated_description_with_lock ||
        `Updated with lock at ${new Date().toISOString()}`;

      logger.debug(`Updating with lock handle: "${updatedDescription}"`);

      // Update with lock handle
      const result = await updateFunctionGroup(connection, {
        function_group_name: functionGroupName,
        description: updatedDescription,
        lock_handle: lockHandle,
        transport_request: testCase.params.transport_request
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(200);

      logger.info(`✓ Function group ${functionGroupName} updated with lock handle`);

      // Unlock manually
      await unlockFunctionGroup(connection, functionGroupName, lockHandle, sessionId || '');
      logger.debug(`✓ Lock released for ${functionGroupName}`);

    } catch (error: any) {
      logger.error(`✗ Failed to update with lock handle: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
