/**
 * Unit test for readSource shared function
 * Tests readObjectSource function for different object types
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readSource.test
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { readObjectSource, supportsSourceCode } from '../../../core/shared/readSource';

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

describe('Shared - readSource', () => {
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

  it('should check if object type supports source code', () => {
    expect(supportsSourceCode('class')).toBe(true);
    expect(supportsSourceCode('program')).toBe(true);
    expect(supportsSourceCode('interface')).toBe(true);
    expect(supportsSourceCode('table')).toBe(true);
    expect(supportsSourceCode('structure')).toBe(true);
    expect(supportsSourceCode('view')).toBe(true);
    expect(supportsSourceCode('domain')).toBe(false);
    expect(supportsSourceCode('dataelement')).toBe(false);
  });

  it('should read class source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use a standard SAP class that should exist
    const className = 'CL_ABAP_CHAR_UTILITIES';
    const result = await readObjectSource(connection, 'class', className);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
  }, 15000);

  it('should read class source code (inactive version)', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const className = 'CL_ABAP_CHAR_UTILITIES';
    const result = await readObjectSource(connection, 'class', className, undefined, 'inactive');
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should throw error for object type without source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      readObjectSource(connection, 'domain', 'MANDT')
    ).rejects.toThrow('does not support source code reading');
  });
});

