/**
 * Integration test for Function Group syntax check
 * Tests checkFunctionGroup function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionGroup/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkFunctionGroup } from '../../../core/functionGroup/check';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Function Group - Check';
const logger = createTestLogger('FUGR-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    functionGroupName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'functionGroup_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_function_group');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_function_group');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    functionGroupName = tc.params.function_group_name || tc.params.function_group;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureFunctionGroupExists(testCase: any): Promise<void> {
    const fgName = testCase.params.function_group_name || testCase.params.function_group;
    if (!fgName) {
      throw new Error('function_group_name or function_group is required in test case');
    }

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
          description: testCase.params.description || `Test function group for ${fgName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
        });
        logger.debug(`Function group ${fgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check active function group', async () => {
    if (!testCase || !functionGroupName) {
      logger.skip('Check Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for function group (active): ${functionGroupName}`);

    try {
      await ensureFunctionGroupExists(testCase);

      const result = await checkFunctionGroup(connection, functionGroupName, 'active');
      expect(result.status).toBe(200);
      logger.info(`✓ Function group ${functionGroupName} syntax check (active) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check function group syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check inactive function group', async () => {
    if (!testCase || !functionGroupName) {
      logger.skip('Check Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for function group (inactive): ${functionGroupName}`);

    try {
      await ensureFunctionGroupExists(testCase);

      const result = await checkFunctionGroup(connection, functionGroupName, 'inactive');
      expect(result.status).toBe(200);
      logger.info(`✓ Function group ${functionGroupName} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check function group syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
