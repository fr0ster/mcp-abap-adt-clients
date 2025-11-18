/**
 * Integration test for Package read
 * Tests getPackage function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/package/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Package - Read';
const logger = createTestLogger('PKG-READ');

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

    const env = await setupTestEnvironment(connection, 'package_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('read_package');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'read_package');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    packageName = tc.params.package_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensurePackageExists(testCase: any): Promise<void> {
    const pkgName = testCase.params.package_name;

    try {
      await getPackage(connection, pkgName);
      logger.debug(`Package ${pkgName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Package ${pkgName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_package', 'test_package');
        if (!createTestCase) {
          throw new Error(`Cannot create package ${pkgName}: create_package test case not found`);
        }

        try {
          await createPackage(connection, {
            package_name: pkgName,
            description: createTestCase.params.description || `Test package for ${pkgName}`,
            package_type: createTestCase.params.package_type || 'development',
            super_package: createTestCase.params.super_package
          });
          logger.debug(`Package ${pkgName} created successfully`);
        } catch (createError: any) {
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read package', async () => {
    if (!testCase || !packageName) {
      logger.skip('Read Test', testCase ? 'Package name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read for package: ${packageName}`);

    try {
      await ensurePackageExists(testCase);

      const result = await getPackage(connection, packageName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Package ${packageName} read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read package: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
