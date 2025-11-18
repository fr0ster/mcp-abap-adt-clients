/**
 * Integration test for Class creation
 * Tests createClass function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/class/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createClass } from '../../../core/class/create';
import { getClassMetadata } from '../../../core/class/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport, loadTestConfig, getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Class - Create';
const logger = createTestLogger('CLASS-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let className: string | null = null;

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
    className = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'class_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_class', 'basic_class');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    className = tc.params.class_name;

    // Delete if exists (idempotency)
    if (className) {
      await deleteIfExists(className);
    }
  });

  afterEach(async () => {
    // Cleanup created class
    if (className) {
      await deleteIgnoringErrors(className);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getClassMetadata(connection, name);
      logger.debug(`Class ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'CLAS/OC'
      });
      const delay = getTimeout('delay', 'create_class') || 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Class ${name} deleted`);
    } catch (error: any) {
      // 404 is OK - object doesn't exist, nothing to delete
      if (error.response?.status !== 404) {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'CLAS/OC'
      });
      logger.debug(`Cleanup: deleted class ${name}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Object doesn't exist - that's fine for cleanup
        return;
      }
      // Show other errors
      logger.error(`Cleanup failed: could not delete class ${name}: ${error.message}`);
    }
  }

  it('should create basic class', async () => {
    if (!testCase || !className) {
      logger.skip('Create Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for class: ${className}`);

    try {
      const result = await createClass(connection, {
        class_name: testCase.params.class_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        superclass: testCase.params.superclass,
        final: testCase.params.final || false,
        abstract: testCase.params.abstract || false
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Class ${className} ${result.status === 201 ? 'created' : 'already exists'}`);

    } catch (error: any) {
      logger.error(`✗ Failed to create class: ${error.message}`);
      throw error;
    }
  }, getTimeout('create', 'create_class'));
});
