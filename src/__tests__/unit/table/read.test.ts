/**
 * Unit test for Table reading
 * Tests getTable function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/table/read.test
 */

import { getTableMetadata, getTableSource } from '../../../core/table/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createTable } from '../../../core/table/create';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Table - Read', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_read', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      await connection.connect();
      hasConfig = true;
      // Check if this is a cloud system using system information endpoint
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
  });

  async function ensureTableExists(testCase: any) {
    try {
      await getTableMetadata(connection, testCase.params.table_name);
      logger.debug(`Table ${testCase.params.table_name} exists`);
    } catch (error: any) {
      // 404 or 406 means table doesn't exist or cannot be read
      if (error.response?.status === 404 || error.response?.status === 406) {
        logger.debug(`Table ${testCase.params.table_name} does not exist (${error.response?.status}), creating...`);
        try {
          const createTestCase = getEnabledTestCase('create_table');
          if (createTestCase) {
            await createTable(connection, {
              table_name: testCase.params.table_name,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              ddl_code: createTestCase.params.ddl_code
            });
            logger.debug(`Table ${testCase.params.table_name} created successfully`);
            // Wait a bit for table to be available
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (createError: any) {
          // If table already exists, that's OK
          if (createError.message?.includes('already exists') ||
              createError.message?.includes('does already exist') ||
              (createError.response?.data &&
               typeof createError.response.data === 'string' &&
               createError.response.data.includes('already exists'))) {
            logger.debug(`Table ${testCase.params.table_name} already exists`);
            return;
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read existing table', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: Table metadata reading is not supported on cloud systems');
      return;
    }

    const testCase = getEnabledTestCase('get_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      await ensureTableExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure table exists: ${error.message}`);
      return;
    }

    const result = await getTableMetadata(connection, testCase.params.table_name);
    expect(result.status).toBe(200);
  }, 15000);

  it('should read table source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: Table source code reading is not supported on cloud systems');
      return;
    }

    const testCase = getEnabledTestCase('get_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      await ensureTableExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure table exists: ${error.message}`);
      return;
    }

    const result = await getTableSource(connection, testCase.params.table_name);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
  }, 15000);
});

