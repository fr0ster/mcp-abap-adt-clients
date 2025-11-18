/**
 * Integration test for Package unlock
 * Tests unlockPackage function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/package/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockPackage } from '../../../core/package/lock';
import { unlockPackage } from '../../../core/package/unlock';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Package - Unlock';
const logger = createTestLogger('PKG-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
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
    // Reset suite variables
    testCase = null;
    packageName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'package_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_package');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    packageName = tc.params.package_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure package exists before test
   */
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
          super_package: createTestCase.params.super_package || getDefaultPackage(),
          description: createTestCase.params.description || `Test package for ${pkgName}`,
          package_type: createTestCase.params.package_type || 'development',
          transport_request: createTestCase.params.transport_request || getDefaultTransport()
        });
        logger.debug(`Package ${pkgName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock package', async () => {
    // Skip if no test case configured
    if (!testCase || !packageName) {
      logger.skip('Unlock Test', testCase ? 'Package name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for package: ${packageName}`);

    try {
      // Ensure package exists
      await ensurePackageExists(testCase);

      // Lock package first
      const lockHandle = await lockPackage(connection, packageName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock package
      const result = await unlockPackage(connection, packageName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Package ${packageName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock package: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});

