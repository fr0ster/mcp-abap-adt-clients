/**
 * Integration test for Function Module read
 * Tests getFunction function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionModule/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getFunction } from '../../../core/functionModule/read';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Function Module - Read';
const logger = createTestLogger('FMOD-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    functionModuleName = null;
    functionGroupName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'functionModule_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_function_module') || getEnabledTestCase('create_function_module', 'test_function_module');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    functionModuleName = tc.params?.function_module_name;
    functionGroupName = tc.params?.function_group_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureFunctionGroupExists(functionGroupName: string, packageName?: string): Promise<void> {
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!fugrTestCase || !fugrTestCase.params.package_name) {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found or missing package_name`);
        }

        await createFunctionGroup(connection, {
          function_group_name: functionGroupName,
          description: fugrTestCase.params.description || `Test FUGR for ${functionGroupName}`,
          package_name: packageName || fugrTestCase.params.package_name
        });
        logger.debug(`Function group ${functionGroupName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  async function ensureFunctionModuleExists(testCase: any): Promise<void> {
    const fmName = testCase.params?.function_module_name;
    const fgName = testCase.params?.function_group_name;

    if (!fmName || !fgName) {
      throw new Error('function_module_name and function_group_name are required in test case');
    }

    try {
      await getFunction(connection, fgName, fmName);
      logger.debug(`Function module ${fmName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${fmName} does not exist, creating...`);
        try {
          await createFunctionModule(connection, {
            function_module_name: fmName,
            function_group_name: fgName,
            description: testCase.params?.description,
            package_name: testCase.params?.package_name,
            source_code: testCase.params?.source_code
          });
          logger.debug(`Function module ${fmName} created successfully`);
        } catch (createError: any) {
          if (createError.message.includes('S_ABPLNGVS')) {
            throw new Error(`Function module name must start with Z_ or Y_ for non-SAP/non-partner users`);
          }
          if (createError.response?.status >= 500) {
            throw new Error(`Server error creating FM ${fmName}: ${createError.message}`);
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read function module', async () => {
    if (!testCase || !functionModuleName || !functionGroupName) {
      logger.skip('Read Test', testCase ? 'Function module/group name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read for function module: ${functionModuleName}`);

    try {
      await ensureFunctionGroupExists(functionGroupName, testCase.params?.package_name);
      await ensureFunctionModuleExists(testCase);

      const result = await getFunction(connection, functionGroupName, functionModuleName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).toContain(functionModuleName);
      logger.info(`✓ Function module ${functionModuleName} read successfully`);

    } catch (error: any) {
      if (error.message?.includes('S_ABPLNGVS') || error.message?.includes('Z_ or Y_')) {
        logger.skip('Read Test', error.message);
        return;
      }
      logger.error(`✗ Failed to read function module: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
