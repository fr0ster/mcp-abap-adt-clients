/**
 * Integration test for Function Module creation
 * Tests createFunctionModule function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionModule/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createFunctionModule } from '../../../core/functionModule/create';
import { getFunctionMetadata } from '../../../core/functionModule/read';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'FunctionModule - Create';
const logger = createTestLogger('FUNC-CREATE');

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

    const env = await setupTestEnvironment(connection, 'functionmodule_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_function_module', 'test_function_module');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_function_module');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    functionModuleName = tc.params.function_module_name;
    functionGroupName = tc.params.function_group_name;

    // Delete if exists (idempotency)
    if (functionModuleName && functionGroupName) {
      await deleteIfExists(functionModuleName);
    }

    // Ensure function group exists
    if (functionGroupName) {
      await ensureFunctionGroupExists(functionGroupName);
    }
  });

  afterEach(async () => {
    // Cleanup created function module
    if (functionModuleName) {
      await deleteIgnoringErrors(functionModuleName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureFunctionGroupExists(groupName: string): Promise<void> {
    try {
      await getFunctionGroup(connection, groupName);
      logger.debug(`Function group ${groupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${groupName} does not exist, creating...`);
        const createFGTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!createFGTestCase) {
          throw new Error(`Cannot create function group ${groupName}: create_function_group test case not found`);
        }
        await createFunctionGroup(connection, {
          function_group_name: groupName,
          description: createFGTestCase.params.description || `Test FG for ${groupName}`,
          package_name: createFGTestCase.params.package_name || getDefaultPackage(),
          transport_request: createFGTestCase.params.transport_request || getDefaultTransport()
        });
        logger.debug(`Function group ${groupName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIfExists(name: string): Promise<void> {
    if (!functionGroupName) return;

    try {
      await getFunctionMetadata(connection, name, functionGroupName);
      logger.debug(`FunctionModule ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'FUGR/FF'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`FunctionModule ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`FunctionModule ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'FUNC/F'
      });
      logger.debug(`Cleanup: deleted function module ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete function module ${name} (${error.message})`);
    }
  }

  it('should create basic function module', async () => {
    if (!testCase || !functionModuleName || !functionGroupName) {
      logger.skip('Create Test', testCase ? 'FunctionModule or FunctionGroup name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for function module: ${functionModuleName} in ${functionGroupName}`);

    try {
      const result = await createFunctionModule(connection, {
        function_module_name: testCase.params.function_module_name,
        function_group_name: testCase.params.function_group_name,
        description: testCase.params.description,
        source_code: testCase.params.source_code || ''
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Function module ${functionModuleName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify function module exists
      const getResult = await getFunctionMetadata(connection, functionModuleName, functionGroupName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ FunctionModule ${functionModuleName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create function module: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
