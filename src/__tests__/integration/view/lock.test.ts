/**
 * Unit test for View locking
 * Tests lockDDLS function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/view/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockDDLS } from '../../../core/view/lock';
import { unlockDDLS } from '../../../core/view/unlock';
import { getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
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

const logger = createTestLogger('View - Lock/Unlock');

const TEST_SUITE_NAME = 'View - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let viewName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    viewName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    lockHandle = null;
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      const env = await setupTestEnvironment(connection, 'view_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      await (connection as any).connect();
      hasConfig = true;

      // Get and validate test case
      const tc = getEnabledTestCase('lock_view', 'test_view_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        viewName = null;
        return;
      }

      testCase = tc;
      viewName = tc.params.view_name;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      viewName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
    lockHandle = null;
  });

  async function ensureViewExists(testCase: any) {
    const viewName = testCase.params.view_name;

    try {
      await getViewMetadata(connection, viewName);
      logger.debug(`View ${viewName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${viewName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view', 'test_view');
        if (createTestCase) {
          try {
            await createView(connection, {
              view_name: viewName,
              description: createTestCase.params.description || `Test view for ${viewName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              ddl_source: createTestCase.params.ddl_source
            });
            logger.debug(`View ${viewName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create view ${viewName}: create_view test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock view and get lock handle', async () => {
    if (!testCase || !viewName) {
      return; // Already logged in beforeEach
    }

    await ensureViewExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockDDLS(
      connection,
      viewName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'view',
        viewName,
        testSessionId,
        lockHandle,
        undefined,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock after test
    try {
      lockHandle = null;

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('view', viewName);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock view: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
