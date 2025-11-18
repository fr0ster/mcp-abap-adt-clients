/**
 * Integration test for Function Group read
 * Tests getFunctionGroup function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionGroup/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Function Group - Read';
const logger = createTestLogger('FUGR-READ');

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

    const env = await setupTestEnvironment(connection, 'functionGroup_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_function_group');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
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
        if (!createTestCase || !createTestCase.params.package_name) {
          throw new Error(`Cannot create function group ${fgName}: create_function_group test case not found or missing package_name`);
        }

        await createFunctionGroup(connection, {
          function_group_name: fgName,
          description: testCase.params.description || `Test function group for ${fgName}`,
          package_name: createTestCase.params.package_name
        });
        logger.debug(`Function group ${fgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should read function group', async () => {
    if (!testCase || !functionGroupName) {
      logger.skip('Read Test', testCase ? 'Function group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read for function group: ${functionGroupName}`);

    try {
      await ensureFunctionGroupExists(testCase);

      const result = await getFunctionGroup(connection, functionGroupName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Function group ${functionGroupName} read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read function group: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
