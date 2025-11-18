/**
 * Integration test for View creation
 * Tests createView function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/view/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createView } from '../../../core/view/create';
import { getViewMetadata } from '../../../core/view/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'View - Create';
const logger = createTestLogger('VIEW-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let viewName: string | null = null;

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
    viewName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'view_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_view');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_view');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    viewName = tc.params.view_name;

    // Delete if exists (idempotency)
    if (viewName) {
      await deleteIfExists(viewName);
    }
  });

  afterEach(async () => {
    // Cleanup created view
    if (viewName) {
      await deleteIgnoringErrors(viewName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getViewMetadata(connection, name);
      logger.debug(`View ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'VIEW/VW'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`View ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'VIEW/DV'
      });
      logger.debug(`Cleanup: deleted view ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete view ${name} (${error.message})`);
    }
  }

  it('should create basic view', async () => {
    if (!testCase || !viewName) {
      logger.skip('Create Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for view: ${viewName}`);

    try {
      const result = await createView(connection, {
        view_name: testCase.params.view_name,
        ddl_source: testCase.params.ddl_source || '',
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ View ${viewName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify view exists
      const getResult = await getViewMetadata(connection, viewName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ View ${viewName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create view: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
