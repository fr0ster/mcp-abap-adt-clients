/**
 * Integration test for Function Group creation
 * Tests createFunctionGroup function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/functionGroup/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'FunctionGroup - Create';
const logger = createTestLogger('FUGR-CREATE');

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

    const env = await setupTestEnvironment(connection, 'functiongroup_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_function_group', 'test_function_group');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_function_group');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    functionGroupName = tc.params.function_group_name;

    // Delete if exists (idempotency)
    if (functionGroupName) {
      await deleteIfExists(functionGroupName);
    }
  });

  afterEach(async () => {
    // Cleanup created function group
    if (functionGroupName) {
      await deleteIgnoringErrors(functionGroupName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getFunctionGroup(connection, name);
      logger.debug(`FunctionGroup ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'FUGR/F'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`FunctionGroup ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`FunctionGroup ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'FUGR/F'
      });
      logger.debug(`Cleanup: deleted function group ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete function group ${name} (${error.message})`);
    }
  }

  it('should create basic function group', async () => {
    if (!testCase || !functionGroupName) {
      logger.skip('Create Test', testCase ? 'FunctionGroup name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for function group: ${functionGroupName}`);

    try {
      const result = await createFunctionGroup(connection, {
        function_group_name: testCase.params.function_group_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport()
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ FunctionGroup ${functionGroupName} created (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify function group exists
      const getResult = await getFunctionGroup(connection, functionGroupName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ FunctionGroup ${functionGroupName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create function group: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
