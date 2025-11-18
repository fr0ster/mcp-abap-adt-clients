/**
 * Integration test for Table syntax check
 * Tests runTableCheckRun function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/table/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { runTableCheckRun } from '../../../core/table/check';
import { getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Table - Check';
const logger = createTestLogger('TABLE-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    tableName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'table_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_table');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_table');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    tableName = tc.params.table_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureTableExists(testCase: any): Promise<void> {
    const tName = testCase.params.table_name;

    try {
      await getTableMetadata(connection, tName);
      logger.debug(`Table ${tName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${tName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_table', 'test_table');
        if (!createTestCase) {
          throw new Error(`Cannot create table ${tName}: create_table test case not found`);
        }

        await createTable(connection, {
          table_name: tName,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          ddl_code: createTestCase.params.ddl_code
        });
        logger.debug(`Table ${tName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check table syntax with abapCheckRun', async () => {
    if (!testCase || !tableName) {
      logger.skip('Check Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for table (abapCheckRun): ${tableName}`);

    try {
      await ensureTableExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await runTableCheckRun(connection, 'abapCheckRun', tableName, checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Table ${tableName} syntax check (abapCheckRun) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check table syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check table status with tableStatusCheck', async () => {
    if (!testCase || !tableName) {
      logger.skip('Check Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for table (tableStatusCheck): ${tableName}`);

    try {
      await ensureTableExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await runTableCheckRun(connection, 'tableStatusCheck', tableName, checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Table ${tableName} status check (tableStatusCheck) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check table status: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
