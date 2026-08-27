/**
 * Unit test for getSqlQuery shared function
 * Tests getSqlQuery function using AdtClient/AdtUtils
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/sqlQuery.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  logTestSkip,
  logTestStart,
  logTestStep,
} from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - getSqlQuery', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      // Check if this is a cloud system using system information endpoint
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it('should execute SQL query', async () => {
    if (!hasConfig) {
      logTestSkip(testsLogger, 'Shared - getSqlQuery', 'No SAP configuration');
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'sql_query',
      testCaseName: 'execute_sql_query',
    });

    const testCase = resolver.getTestCase();
    if (!testCase || !resolver.isEnabled()) {
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        'Test case not found or disabled',
      );
      return;
    }

    if (!resolver.isAvailableForEnvironment()) {
      logTestStart(testsLogger, 'Shared - getSqlQuery', {
        name: 'execute_sql_query',
        params: {},
      });
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        `Test not available for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment. ` +
          `SQL queries are only supported on on-premise systems.`,
      );
      return;
    }

    // Get SQL query from params or build from standard_objects.tables
    let sqlQuery = resolver.getParam('sql_query');
    if (!sqlQuery) {
      const tableName = resolver.getObjectName('table_name', 'table');
      sqlQuery = `SELECT * FROM ${tableName}`;
    }
    const rowNumber = resolver.getParam('row_number', 10);

    logTestStep('execute SQL query', testsLogger);
    const result = await withAcceptHandling(
      client.getUtils().getSqlQuery({
        sql_query: sqlQuery,
        row_number: rowNumber,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should use default row_number if not provided', async () => {
    if (!hasConfig) {
      logTestSkip(testsLogger, 'Shared - getSqlQuery', 'No SAP configuration');
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'sql_query',
      testCaseName: 'execute_sql_query_default_row_number',
    });

    const testCase = resolver.getTestCase();
    if (!testCase || !resolver.isEnabled()) {
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        'Test case not found or disabled',
      );
      return;
    }

    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        `Test not available for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment. ` +
          `SQL queries are only supported on on-premise systems.`,
      );
      return;
    }

    // Get SQL query from params or build from standard_objects.tables
    let sqlQuery = resolver.getParam('sql_query');
    if (!sqlQuery) {
      const tableName = resolver.getObjectName('table_name', 'table');
      sqlQuery = `SELECT * FROM ${tableName}`;
    }

    logTestStep('execute SQL query with default row_number', testsLogger);
    const result = await withAcceptHandling(
      client.getUtils().getSqlQuery({
        sql_query: sqlQuery,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should throw error if SQL query is missing', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'sql_query',
    });

    const testCase = resolver.getTestCase();
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        'Test not available for current environment',
      );
      return;
    }

    logTestStep('validate error if SQL query is missing', testsLogger);
    await expect(
      client.getUtils().getSqlQuery({
        sql_query: '',
      }),
    ).rejects.toThrow('SQL query is required');
  });
});
