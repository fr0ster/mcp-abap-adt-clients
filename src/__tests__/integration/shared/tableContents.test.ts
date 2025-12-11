/**
 * Unit test for getTableContents shared function
 * Tests getTableContents function using AdtClient/AdtUtils
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/tableContents.test
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { ILogger } from '@mcp-abap-adt/interfaces';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger: ILogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

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
    const uaaClientId = process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret = process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Shared - getTableContents', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await connection.connect();
      client = new AdtClient(connection, logger);
      hasConfig = true;
      // Check if this is a cloud system using system information endpoint
      isCloudSystem = await isCloudEnvironment(connection);
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

  it('should get table contents', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: Table contents are not supported on cloud systems');
      return;
    }

    const result = await client.getUtils().getTableContents({
      table_name: 'T000',
      max_rows: 10
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should use default max_rows if not provided', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: Table contents are not supported on cloud systems');
      return;
    }

    const result = await client.getUtils().getTableContents({
      table_name: 'T000'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should throw error if table name is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // This test doesn't require actual connection, but we skip on cloud for consistency
    if (isCloudSystem) {
      logger.warn('⚠️ Skipping test: Table contents are not supported on cloud systems');
      return;
    }

    await expect(
      client.getUtils().getTableContents({
        table_name: ''
      })
    ).rejects.toThrow('Table name is required');
  });
});

