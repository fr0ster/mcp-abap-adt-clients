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
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Table - Lock', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
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

  it('should lock table and get lock handle', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('lock_table');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'lock_table');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureTableExists(testCase);

    const sessionId = generateSessionId();
    const lockHandle = await acquireTableLockHandle(
      connection,
      testCase.params.table_name,
      sessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Unlock after test
    try {
      await unlockTable(connection, testCase.params.table_name, lockHandle, sessionId);
    } catch (error) {
      // Ignore unlock errors
    }
  }, 30000);
});

