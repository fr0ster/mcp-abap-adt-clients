/**
 * Unit test for getTableContents shared function
 * Tests getTableContents function
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/tableContents.test
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getTableContents } from '../../../core/shared/tableContents';
import { isCloudEnvironment } from '../../../utils/systemInfo';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
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
  let hasConfig = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
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

    const result = await getTableContents(connection, {
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

    const result = await getTableContents(connection, {
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

    await expect(
      getTableContents(connection, {
        table_name: ''
      })
    ).rejects.toThrow('Table name is required');
  });
});

