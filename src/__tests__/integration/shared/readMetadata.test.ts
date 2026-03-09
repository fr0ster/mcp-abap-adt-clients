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
import type { AdtClient } from '../../../clients/AdtClient';
import type { AdtObjectType } from '../../../core/shared/types';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { createTestAdtClient } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger = createTestsLogger();
const { isHttpStatusAllowed } = require('../../helpers/test-helper');

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
  let isLegacy = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      await (connection as any).connect();
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
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

  it('should read class metadata', async () => {
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
      handlerName: 'read_metadata',
      testCaseName: 'read_class_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const className = resolver.getObjectName('class_name', 'class');
    if (!className) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No class configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read class metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${className} (class)`);
      testsLogger.info?.('📖 Reading metadata...');

      const activeResult = await client
        .getUtils()
        .readObjectMetadata('class', className, undefined, {
          version: 'active',
        });
      const inactiveResult = await client
        .getUtils()
        .readObjectMetadata('class', className, undefined, {
          version: 'inactive',
        });

      expect(activeResult.status).toBe(200);
      expect(activeResult.data).toBeDefined();
      logTestStep(
        `metadata active size: ${activeResult.data?.length || 0} bytes`,
        testsLogger,
      );

      expect(inactiveResult.status).toBe(200);
      expect(inactiveResult.data).toBeDefined();
      logTestStep(
        `metadata inactive size: ${inactiveResult.data?.length || 0} bytes`,
        testsLogger,
      );

      testsLogger.info?.('✅ Metadata retrieved');
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
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

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_domain_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const domainName = resolver.getObjectName('domain_name', 'domain');
    if (!domainName) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No domain configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read domain metadata', testsLogger);
      testsLogger.info?.(`📋 Object: ${domainName} (domain)`);
      testsLogger.info?.('📖 Reading metadata...');

      const result = await client
        .getUtils()
        .readObjectMetadata('domain', domainName);

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Metadata retrieved');
      logTestStep(
        `metadata size: ${result.data?.length || 0} bytes`,
        testsLogger,
      );
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
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

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_table_metadata',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    const tableName = resolver.getObjectName('table_name', 'table');
    if (!tableName) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'No table configured in standard_objects',
      );
      return;
    }
    try {
      logTestStep('read table metadata', testsLogger);
      const result = await client
        .getUtils()
        .readObjectMetadata('table', tableName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    } catch (error: any) {
      if (error.response?.status === 406) {
        if (isHttpStatusAllowed(406, { params: {} })) {
          testsLogger.warn?.(
            '⚠️ Skipping test: 406 Not Acceptable (Accept header not supported)',
          );
          return;
        }
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

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_metadata',
      testCaseName: 'read_metadata_error_unsupported',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - readMetadata',
        'Test not available for current environment',
      );
      return;
    }

    logTestStep('validate error for unsupported object type', testsLogger);
    await expect(
      client
        .getUtils()
        // Force runtime validation for invalid inputs.
        .readObjectMetadata(
          'unsupported_type' as unknown as AdtObjectType,
          'TEST',
        ),
    ).rejects.toThrow('Unsupported object type for metadata');
  });
});
