/**
 * Unit test for searchObjects shared function
 * Tests searchObjects function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/search.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { logBuilderTestStep } from '../../helpers/builderTestLogger';
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

describe('Shared - searchObjects', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      client = new AdtClient(connection, testsLogger);
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

  it('should search objects by name pattern', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logBuilderTestStep('search objects by name pattern', testsLogger);
    testsLogger.info?.('🔍 Query: CL_ABAP*, maxResults: 10');

    const result = await withAcceptHandling(
      client.getUtils().searchObjects({
        query: 'CL_ABAP*',
        maxResults: 10,
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    testsLogger.info?.('✅ Search completed');
    testsLogger.info?.(`📊 Response size: ${result.data?.length || 0} bytes`);

    // Parse and log number of results
    const matches = result.data?.match(/<objectReference/g);
    if (matches) {
      testsLogger.info?.(`🎯 Found ${matches.length} objects`);
    }
  }, 15000);

  it('should search objects with object type filter', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logBuilderTestStep('search objects with object type filter', testsLogger);
    testsLogger.info?.('🔍 Query: T*, objectType: TABL, maxResults: 10');

    const result = await withAcceptHandling(
      client.getUtils().searchObjects({
        query: 'T*',
        objectType: 'TABL',
        maxResults: 10,
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    testsLogger.info?.('✅ Search completed');
    testsLogger.info?.(`📊 Response size: ${result.data?.length || 0} bytes`);

    // Parse and log number of results
    const matches = result.data?.match(/<objectReference/g);
    if (matches) {
      testsLogger.info?.(`🎯 Found ${matches.length} tables`);
    }
  }, 15000);

  it('should use default maxResults if not provided', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logBuilderTestStep('search objects with default maxResults', testsLogger);
    const result = await withAcceptHandling(
      client.getUtils().searchObjects({
        query: 'CL_ABAP*',
      }),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);
});
