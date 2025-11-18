/**
 * Integration test for View unlock
 * Tests unlockDDLS function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/view/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockDDLS } from '../../../core/view/lock';
import { unlockDDLS } from '../../../core/view/unlock';
import { getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'View - Unlock';
const logger = createTestLogger('VIEW-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
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
    // Reset suite variables
    testCase = null;
    viewName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'view_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_view');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    viewName = tc.params.view_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure view exists before test
   */
  async function ensureViewExists(testCase: any): Promise<void> {
    const vName = testCase.params.view_name;

    try {
      await getViewMetadata(connection, vName);
      logger.debug(`View ${vName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${vName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view', 'test_view');
        if (!createTestCase) {
          throw new Error(`Cannot create view ${vName}: create_view test case not found`);
        }

        await createView(connection, {
          view_name: vName,
          description: createTestCase.params.description || `Test view for ${vName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          ddl_source: createTestCase.params.ddl_source
        });
        logger.debug(`View ${vName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock view', async () => {
    // Skip if no test case configured
    if (!testCase || !viewName) {
      logger.skip('Unlock Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for view: ${viewName}`);

    try {
      // Ensure view exists
      await ensureViewExists(testCase);

      // Lock view first
      const lockHandle = await lockDDLS(connection, viewName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock view
      const result = await unlockDDLS(connection, viewName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ View ${viewName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock view: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
