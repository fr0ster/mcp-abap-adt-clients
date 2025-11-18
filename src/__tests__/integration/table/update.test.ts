/**
 * Integration test for Table update
 * Tests updateTable function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/table/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateTable } from '../../../core/table/update';
import { getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Table - Update';
const logger = createTestLogger('TABLE-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'table_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_table');
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

  it('should update table', async () => {
    if (!testCase || !tableName) {
      logger.skip('Update Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for table: ${tableName}`);

    try {
      await ensureTableExists(testCase);

      await updateTable(connection, {
        table_name: tableName,
        ddl_code: testCase.params.ddl_code,
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        activate: testCase.params.activate || false
      });
      logger.debug(`✓ Table ${tableName} updated`);

      const result = await getTableMetadata(connection, tableName);
      expect(result.status).toBe(200);
      logger.info(`✓ Table ${tableName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update table: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
