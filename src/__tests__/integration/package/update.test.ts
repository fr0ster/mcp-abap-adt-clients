/**
 * Integration test for Package update
 * Tests updatePackage function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/package/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updatePackage } from '../../../core/package/update';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { lockPackage } from '../../../core/package/lock';
import { unlockPackage } from '../../../core/package/unlock';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Package - Update';
const logger = createTestLogger('PKG-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'package_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_package');
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

  it('should update package', async () => {
    if (!testCase || !packageName) {
      logger.skip('Update Test', testCase ? 'Package name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for package: ${packageName}`);

    const updateSessionId = generateSessionId();
    let lockHandle: string | null = null;

    try {
      await ensurePackageExists(testCase);

      lockHandle = await lockPackage(connection, packageName, updateSessionId);
      logger.debug(`✓ Package ${packageName} locked`);

      await updatePackage(connection, {
        package_name: packageName,
        super_package: testCase.params.super_package || getDefaultPackage(),
        description: testCase.params.description,
        package_type: testCase.params.package_type || 'development',
        transport_request: testCase.params.transport_request || getDefaultTransport()
      }, lockHandle, updateSessionId);
      logger.debug(`✓ Package ${packageName} updated`);

      const result = await getPackage(connection, packageName);
      expect(result.status).toBe(200);
      logger.info(`✓ Package ${packageName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update package: ${error.message}`);
      throw error;
    } finally {
      if (lockHandle) {
        try {
          await unlockPackage(connection, packageName, lockHandle, updateSessionId);
          logger.debug(`✓ Package ${packageName} unlocked`);
        } catch (error) {
          logger.debug(`⚠️ Unlock error ignored`);
        }
      }
    }
  }, getTimeout('test'));
});
