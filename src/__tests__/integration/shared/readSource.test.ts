/**
 * Unit test for readSource shared function
 * Tests readObjectSource function for different object types using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readSource.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import type { AdtSourceObjectType } from '../../../core/shared/types';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();
// Test execution logs use DEBUG_ADT_TESTS
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

describe('Shared - readSource', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, connectionLogger);
      hasConfig = true;
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

  it('should check if object type supports source code', () => {
    if (!hasConfig || !client) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }
    logTestStep('check if object type supports source code', testsLogger);
    const utils = client.getUtils();
    expect(utils.supportsSourceCode('class')).toBe(true);
    expect(utils.supportsSourceCode('program')).toBe(true);
    expect(utils.supportsSourceCode('interface')).toBe(true);
    expect(utils.supportsSourceCode('table')).toBe(true);
    expect(utils.supportsSourceCode('structure')).toBe(true);
    expect(utils.supportsSourceCode('view')).toBe(true);
    expect(utils.supportsSourceCode('domain')).toBe(false);
    expect(utils.supportsSourceCode('dataelement')).toBe(false);
  });

  it('should read class source code', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    // Use a standard SAP class that should exist
    const className = 'CL_ABAP_CHAR_UTILITIES';
    logTestStep('read class source code', testsLogger);
    testsLogger.info?.(`📋 Object: ${className} (class)`);
    testsLogger.info?.('📖 Reading source code...');

    const result = await withAcceptHandling(
      client.getUtils().readObjectSource('class', className),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');

    testsLogger.info?.('✅ Source code retrieved');
    testsLogger.info?.(
      `📊 Source length: ${result.data?.length || 0} characters`,
    );
  }, 15000);

  it('should read class source code (inactive version)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const className = 'CL_ABAP_CHAR_UTILITIES';
    logTestStep('read class source code (inactive version)', testsLogger);
    const result = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'inactive'),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should read class source code (active and inactive versions)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const className = 'CL_ABAP_CHAR_UTILITIES';
    logTestStep(
      'read class source code (active and inactive versions)',
      testsLogger,
    );

    logTestStep('read class source (active)', testsLogger);
    const activeResult = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'active'),
    );
    expect(activeResult.status).toBe(200);
    expect(activeResult.data).toBeDefined();
    logTestStep(
      `active source length: ${activeResult.data?.length || 0} characters`,
      testsLogger,
    );

    logTestStep('read class source (inactive)', testsLogger);
    const inactiveResult = await withAcceptHandling(
      client
        .getUtils()
        .readObjectSource('class', className, undefined, 'inactive'),
    );
    expect(inactiveResult.status).toBe(200);
    expect(inactiveResult.data).toBeDefined();
    logTestStep(
      `inactive source length: ${inactiveResult.data?.length || 0} characters`,
      testsLogger,
    );
  }, 15000);

  it('should throw error for object type without source code', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep(
      'validate error for object type without source code',
      testsLogger,
    );
    await expect(
      client
        .getUtils()
        // Force runtime validation for invalid inputs.
        .readObjectSource('domain' as unknown as AdtSourceObjectType, 'MANDT'),
    ).rejects.toThrow('does not support source code reading');
  });
});
