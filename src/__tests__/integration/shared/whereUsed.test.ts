/**
 * Unit test for getWhereUsed shared function
 * Tests getWhereUsed function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/whereUsed.test
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getWhereUsed } from '../../../core/shared/whereUsed';

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

describe('Shared - getWhereUsed', () => {
  let connection: IAbapConnection;
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

  it('should get where-used for class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await getWhereUsed(connection, {
      object_name: 'CL_ABAP_CHAR_UTILITIES',
      object_type: 'class'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should get where-used for table', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await getWhereUsed(connection, {
      object_name: 'T000',
      object_type: 'table'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should throw error if object name is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      getWhereUsed(connection, {
        object_name: '',
        object_type: 'class'
      })
    ).rejects.toThrow('Object name is required');
  });

  it('should throw error if object type is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      getWhereUsed(connection, {
        object_name: 'TEST',
        object_type: ''
      })
    ).rejects.toThrow('Object type is required');
  });
});

