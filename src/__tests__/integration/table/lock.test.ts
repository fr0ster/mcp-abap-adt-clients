/**
 * Unit test for Table locking
 * Tests acquireTableLockHandle function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/table/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { acquireTableLockHandle } from '../../../core/table/lock';
import { unlockTable } from '../../../core/table/unlock';
import { getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
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

const logger = createTestLogger('Table - Lock/Unlock');

const TEST_SUITE_NAME = 'Table - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let tableName: string | null = null;

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
    tableName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    if (!hasConfig) {
      return;
    }

    try {
      const env = await setupTestEnvironment(connection, 'table_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      const tc = getEnabledTestCase('lock_table', 'test_table_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        tableName = null;
        return;
      }

      testCase = tc;
      tableName = tc.params.table_name;
    } catch (error: any) {
      logger.error('Setup failed:', error.message);
      testCase = null;
      tableName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    sessionId = null;
    testConfig = null;
    lockTracking = null;
  });

  async function ensureTableExists(testCase: any) {
    const tableName = testCase.params.table_name;

    try {
      await getTableMetadata(connection, tableName);
      logger.debug(`Table ${tableName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${tableName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_table', 'test_table');
        if (createTestCase) {
          try {
            await createTable(connection, {
              table_name: tableName,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              ddl_code: createTestCase.params.ddl_code
            });
            logger.debug(`Table ${tableName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create table ${tableName}: create_table test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock table and get lock handle', async () => {
    if (!testCase || !tableName) {
      return; // Already logged in beforeEach
    }

    await ensureTableExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await acquireTableLockHandle(
      connection,
      tableName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Note: Table locks not tracked in lock registry (not supported by lockHelper)

    // Unlock after test
    try {
      await unlockTable(connection, tableName, lockHandle, testSessionId);
      lockHandle = null;
      logger.debug(`✓ Table unlocked successfully`);
    } catch (error) {
      logger.error(`Failed to unlock table: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
