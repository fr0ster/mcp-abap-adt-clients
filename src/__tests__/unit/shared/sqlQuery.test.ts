/**
 * Unit test for getSqlQuery shared function
 * Tests getSqlQuery function
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/sqlQuery.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { getSqlQuery } from '../../../core/shared/sqlQuery';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Shared - getSqlQuery', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_sqlQuery', __filename);
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

  it('should execute SQL query', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: SQL queries are not supported on cloud systems');
      return;
    }

    const result = await getSqlQuery(connection, {
      sql_query: 'SELECT * FROM T000',
      row_number: 10
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should use default row_number if not provided', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: SQL queries are not supported on cloud systems');
      return;
    }

    const result = await getSqlQuery(connection, {
      sql_query: 'SELECT * FROM T000'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should throw error if SQL query is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      getSqlQuery(connection, {
        sql_query: ''
      })
    ).rejects.toThrow('SQL query is required');
  });
});

