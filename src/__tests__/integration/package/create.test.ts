/**
 * Integration test for Package creation
 * Tests createPackage function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/package/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createPackage } from '../../../core/package/create';
import { getPackage } from '../../../core/package/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Package - Create';
const logger = createTestLogger('PKG-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let packageName: string | null = null;

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
    packageName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'package_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_package', 'test_package');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_package');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    packageName = tc.params.package_name; // This is the package we CREATE (not super_package!)

    // Delete if exists (idempotency)
    if (packageName) {
      await deleteIfExists(packageName);
    }
  });

  afterEach(async () => {
    // Cleanup created package
    if (packageName) {
      await deleteIgnoringErrors(packageName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getPackage(connection, name);
      logger.debug(`Package ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'DEVC/K'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Package ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Package ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'DEVC/K'
      });
      logger.debug(`Cleanup: deleted package ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete package ${name} (${error.message})`);
    }
  }

  it('should create basic package', async () => {
    if (!testCase || !packageName) {
      logger.skip('Create Test', testCase ? 'Package name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for package: ${packageName}`);

    try {
      const result = await createPackage(connection, {
        package_name: testCase.params.package_name,      // Package to CREATE
        description: testCase.params.description,
        super_package: testCase.params.super_package,   // Parent package (like package_name in other tests)
        package_type: testCase.params.package_type || 'development',
        responsible: testCase.params.responsible
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Package ${packageName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify package exists
      const getResult = await getPackage(connection, packageName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Package ${packageName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create package: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
