/**
 * Integration test for Table creation
 * Tests createTable function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/table/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createTable } from '../../../core/table/create';
import { getTableMetadata } from '../../../core/table/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Table - Create';
const logger = createTestLogger('TABLE-CREATE');

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

    const env = await setupTestEnvironment(connection, 'table_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_table');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_table');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    tableName = tc.params.table_name;

    // Delete if exists (idempotency)
    if (tableName) {
      await deleteIfExists(tableName);
    }
  });

  afterEach(async () => {
    // Cleanup created table
    if (tableName) {
      await deleteIgnoringErrors(tableName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getTableMetadata(connection, name);
      logger.debug(`Table ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'TABL/DT'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Table ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'TABL/DT'
      });
      logger.debug(`Cleanup: deleted table ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete table ${name} (${error.message})`);
    }
  }

  it('should create basic table', async () => {
    if (!testCase || !tableName) {
      logger.skip('Create Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for table: ${tableName}`);

    try {
      const result = await createTable(connection, {
        table_name: testCase.params.table_name,
        ddl_code: testCase.params.ddl_code || '',
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport()
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Table ${tableName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify table exists
      const getResult = await getTableMetadata(connection, tableName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Table ${tableName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create table: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
