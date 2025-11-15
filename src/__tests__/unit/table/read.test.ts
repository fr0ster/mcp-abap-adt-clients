/**
 * Unit test for Table reading
 * Tests getTable function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/table/read.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getTableSource, getTableMetadata } from '../../../core/table/read';
import { createTable } from '../../../core/table/create';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Table - Read', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureTableExists(testCase: any) {
    try {
      await getTableMetadata(connection, testCase.params.table_name);
      logger.debug(`Table ${testCase.params.table_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Table ${testCase.params.table_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_table');
        if (createTestCase) {
          await createTable(connection, {
            table_name: testCase.params.table_name,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            ddl_code: createTestCase.params.ddl_code
          });
          logger.debug(`Table ${testCase.params.table_name} created successfully`);
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

    const testCase = getEnabledTestCase('get_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureTableExists(testCase);

    const result = await getTableMetadata(connection, testCase.params.table_name);
    expect(result.status).toBe(200);
  }, 15000);

  it('should read table source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureTableExists(testCase);

    const result = await getTableSource(connection, testCase.params.table_name);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
  }, 15000);
});

