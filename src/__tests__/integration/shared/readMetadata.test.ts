/**
 * Unit test for readMetadata shared function
 * Tests readObjectMetadata function for different object types using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readMetadata.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { logBuilderTestStep } from '../../helpers/builderTestLogger';
import { createTestsLogger } from '../../helpers/testLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger = createTestsLogger();

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

describe('Shared - readMetadata', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      await (connection as any).connect();
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

  it('should read class metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    // Use a standard SAP class that should exist
    const className = 'CL_ABAP_CHAR_UTILITIES';
    try {
      logBuilderTestStep('read class metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${className} (class)`);
      testsLogger.info?.('📖 Reading metadata...');

      const result = await client
        .getUtils()
        .readObjectMetadata('class', className);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Metadata retrieved');
      testsLogger.info?.(`📊 Metadata size: ${result.data?.length || 0} bytes`);
    } catch (error: any) {
      if (error.response?.status === 406) {
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should read domain metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    // Use a standard SAP domain that should exist
    const domainName = 'MANDT';
    try {
      logBuilderTestStep('read domain metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${domainName} (domain)`);
      testsLogger.info?.('📖 Reading metadata...');

      const result = await client
        .getUtils()
        .readObjectMetadata('domain', domainName);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Metadata retrieved');
      testsLogger.info?.(`📊 Metadata size: ${result.data?.length || 0} bytes`);
    } catch (error: any) {
      if (error.response?.status === 406) {
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should read table metadata', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    // Use a standard SAP table that should exist
    const tableName = 'T000';
    try {
      logBuilderTestStep('read table metadata', testsLogger);
      const result = await client
        .getUtils()
        .readObjectMetadata('table', tableName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    } catch (error: any) {
      if (error.response?.status === 406) {
        throw new Error(
          `406 Not Acceptable: The server cannot produce a response matching the Accept header. This may indicate an issue with the Accept header format or the object may not be accessible. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 15000);

  it('should throw error for unsupported object type', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logBuilderTestStep(
      'validate error for unsupported object type',
      testsLogger,
    );
    await expect(
      client.getUtils().readObjectMetadata('unsupported_type', 'TEST'),
    ).rejects.toThrow('Unsupported object type for metadata');
  });
});
