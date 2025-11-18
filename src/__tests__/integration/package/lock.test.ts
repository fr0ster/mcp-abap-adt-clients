/**
 * Unit test for Package locking
 * Tests lockPackage function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockPackage } from '../../../core/package/lock';
import { unlockPackage } from '../../../core/package/unlock';
import { getPackage } from '../../../core/package/read';
import { createPackage } from '../../../core/package/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
import { registerTestLock, unregisterTestLock } from '../../helpers/lockHelper';
import { createTestLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger = createTestLogger('Package - Lock/Unlock');

const TEST_SUITE_NAME = 'Package - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let packageName: string | null = null;

  beforeAll(async () => {
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    packageName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    if (!hasConfig) {
      return;
    }

    try {
      const env = await setupTestEnvironment(connection, 'package_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      const tc = getEnabledTestCase('lock_package', 'test_package_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        packageName = null;
        return;
      }

      testCase = tc;
      packageName = tc.params.package_name;
    } catch (error: any) {
      logger.error('Setup failed:', error.message);
      testCase = null;
      packageName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    sessionId = null;
    testConfig = null;
    lockTracking = null;
  });

  async function ensurePackageExists(testCase: any) {
    const packageName = testCase.params.package_name;

    try {
      await getPackage(connection, packageName);
      logger.debug(`Package ${packageName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Package ${packageName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_package', 'test_package');
        if (createTestCase) {
          try {
            await createPackage(connection, {
              package_name: packageName,
              super_package: createTestCase.params.super_package || getDefaultPackage(),
              description: createTestCase.params.description || `Test package for ${packageName}`,
              package_type: createTestCase.params.package_type || 'development',
              transport_request: createTestCase.params.transport_request || getDefaultTransport()
            });
            logger.debug(`Package ${packageName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create package ${packageName}: create_package test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock package and get lock handle', async () => {
    if (!testCase || !packageName) {
      return; // Already logged in beforeEach
    }

    await ensurePackageExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockPackage(
      connection,
      packageName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Note: Package locks not tracked in lock registry (not supported by lockHelper)

    // Unlock after test
    try {
      await unlockPackage(connection, packageName, lockHandle, testSessionId);
      lockHandle = null;
      logger.debug(`✓ Package unlocked successfully`);
    } catch (error) {
      logger.error(`Failed to unlock package: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
