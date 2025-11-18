/**
 * Integration test for Table read
 * Tests getTableMetadata and getTableSource functions (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/table/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getTableSource, getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Table - Read';
const logger = createTestLogger('TABLE-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let tableName: string | null = null;
  let isCloudSystem = false;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await (connection as any).connect();
    isCloudSystem = await isCloudEnvironment(connection);
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

    const env = await setupTestEnvironment(connection, 'table_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_table');
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
    const tName = testCase.params.table_name;

    try {
      await getTableMetadata(connection, tName);
      logger.debug(`Table ${tName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 406) {
        logger.debug(`Table ${tName} does not exist (${error.response?.status}), creating...`);
        try {
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
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (createError: any) {
          if (createError.message?.includes('already exists') ||
              createError.message?.includes('does already exist') ||
              (createError.response?.data &&
               typeof createError.response.data === 'string' &&
               createError.response.data.includes('already exists'))) {
            logger.debug(`Table ${tName} already exists`);
            return;
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read table metadata', async () => {
    if (!testCase || !tableName) {
      logger.skip('Read Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    if (isCloudSystem) {
      logger.skip('Read Test', 'Table metadata reading not supported on cloud systems');
      return;
    }

    logger.info(`Testing read metadata for table: ${tableName}`);

    try {
      await ensureTableExists(testCase);

      const result = await getTableMetadata(connection, tableName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Table ${tableName} metadata read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read table metadata: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read table source code', async () => {
    if (!testCase || !tableName) {
      logger.skip('Read Test', testCase ? 'Table name not set' : 'Test case not configured');
      return;
    }

    if (isCloudSystem) {
      logger.skip('Read Test', 'Table source code reading not supported on cloud systems');
      return;
    }

    logger.info(`Testing read source for table: ${tableName}`);

    try {
      await ensureTableExists(testCase);

      const result = await getTableSource(connection, tableName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      logger.info(`✓ Table ${tableName} source read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read table source: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
