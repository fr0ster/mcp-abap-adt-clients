/**
 * Integration test for Table unlock
 * Tests unlockTable function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/table/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { acquireTableLockHandle } from '../../../core/table/lock';
import { unlockTable } from '../../../core/table/unlock';
import { getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Table - Unlock';
const logger = createTestLogger('TABLE-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let tableName: string | null = null;

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
    tableName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'table_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_table');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    tableName = tc.params.table_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure table exists before test
   */
  async function ensureTableExists(testCase: any): Promise<void> {
    const tblName = testCase.params.table_name;

    try {
      await getTableMetadata(connection, tblName);
      logger.debug(`Table ${tblName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${tblName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_table', 'test_table');
        if (!createTestCase) {
          throw new Error(`Cannot create table ${tblName}: create_table test case not found`);
        }

        await createTable(connection, {
          table_name: tblName,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          ddl_code: createTestCase.params.ddl_code
        });
        logger.debug(`Table ${tblName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock table', async () => {
    // Skip if no test case configured
    if (!testCase || !tableName) {
      logger.skip('Unlock Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for table: ${tableName}`);

    try {
      // Ensure table exists
      await ensureTableExists(testCase);

      // Lock table first
      const lockHandle = await acquireTableLockHandle(connection, tableName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock table
      const result = await unlockTable(connection, tableName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Table ${tableName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock table: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
