/**
 * Unit test for Table update
 * Tests updateTable function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/table/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { updateTable } from '../../../core/table/update';
import { getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { getConfig } from '../../helpers/sessionConfig';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

if (fs.existsSync(envPath)) {
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Table - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_update', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      hasConfig = true;
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
    const tableName = testCase.params.table_name;

    try {
      await getTableMetadata(connection, tableName);
      logger.debug(`Table ${tableName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${tableName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_table');
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

  it('should update table', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'update_table');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureTableExists(testCase);

    await updateTable(connection, {
      table_name: testCase.params.table_name,
      ddl_code: testCase.params.ddl_code,
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      activate: testCase.params.activate || false
    });

    // Verify update by reading
    const result = await getTableMetadata(connection, testCase.params.table_name);
    expect(result.status).toBe(200);
  }, 60000);
});

