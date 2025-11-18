/**
 * Integration test for Package check
 * Tests checkPackage function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/package/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkPackage } from '../../../core/package/check';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Package - Check';
const logger = createTestLogger('PACKAGE-CHECK');

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

    const env = await setupTestEnvironment(connection, 'package_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_package');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_package');
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

        await createPackage(connection, {
          package_name: pkgName,
          description: createTestCase.params.description || `Test package for ${pkgName}`,
          package_type: createTestCase.params.package_type || 'development',
          super_package: createTestCase.params.super_package
        });
        logger.debug(`Package ${pkgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check package', async () => {
    if (!testCase || !packageName) {
      logger.skip('Check Test', testCase ? 'Package name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing check for package: ${packageName}`);

    try {
      await ensurePackageExists(testCase);

      await checkPackage(connection, packageName);
      expect(true).toBe(true);
      logger.info(`✓ Package ${packageName} check completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check package: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
