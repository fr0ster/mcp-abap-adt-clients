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
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  logTestSkip,
  logTestStart,
  logTestStep,
} from '../../helpers/testProgressLogger';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;

    // Add refresh credentials for auto-refresh (if available)
    const refreshToken = process.env.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }

    const uaaUrl = process.env.SAP_UAA_URL || process.env.UAA_URL;
    const uaaClientId =
      process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret =
      process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing SAP_USERNAME or SAP_PASSWORD for basic authentication',
      );
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Shared - getSqlQuery', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, testsLogger);
      hasConfig = true;
      // Check if this is a cloud system using system information endpoint
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (_error) {
      testsLogger.warn?.(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should execute SQL query', async () => {
    if (!hasConfig) {
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        'No SAP configuration',
      );
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
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
        `Test not available for ${isCloudSystem ? 'cloud' : 'on-premise'} environment. ` +
          `SQL queries are only supported on on-premise systems.`,
      );
      return;
    }

    // Get SQL query from params or build from standard_objects.tables
    let sqlQuery = resolver.getParam('sql_query');
    if (!sqlQuery) {
      const tableName = resolver.getObjectName('table_name', 'table') || 'T000';
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
      logTestSkip(
        testsLogger,
        'Shared - getSqlQuery',
        'No SAP configuration',
      );
      return;
    }

    // Get test case from YAML configuration
    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
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
        `Test not available for ${isCloudSystem ? 'cloud' : 'on-premise'} environment. ` +
          `SQL queries are only supported on on-premise systems.`,
      );
      return;
    }

    // Get SQL query from params or build from standard_objects.tables
    let sqlQuery = resolver.getParam('sql_query');
    if (!sqlQuery) {
      const tableName = resolver.getObjectName('table_name', 'table') || 'T000';
      sqlQuery = `SELECT * FROM ${tableName}`;
    }

    logTestStep(
      'execute SQL query with default row_number',
      testsLogger,
    );
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

    logTestStep('validate error if SQL query is missing', testsLogger);
    await expect(
      client.getUtils().getSqlQuery({
        sql_query: '',
      }),
    ).rejects.toThrow('SQL query is required');
  });
});
