/**
 * Unit test for getWhereUsed shared function
 * Tests getWhereUsed function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/whereUsed.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

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

describe('Shared - getWhereUsed', () => {
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

  it('should use default scope without modifications (Eclipse default behavior)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }
    logTestStep('where-used with default scope', testsLogger);
    testsLogger.info?.('📋 Object: CL_ABAP_CHAR_UTILITIES (class)');
    testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

    const utils = client.getUtils();
    const scopeResponse = await withAcceptHandling(
      utils.getWhereUsedScope({
        object_name: 'CL_ABAP_CHAR_UTILITIES',
        object_type: 'class',
      }),
    );

    expect(scopeResponse.status).toBe(200);
    expect(scopeResponse.data).toBeDefined();

    // Step 2: Use scope WITHOUT modifications (exactly as SAP returned it)
    testsLogger.info?.(
      '🔍 Step 2: Executing where-used search with UNMODIFIED scope...',
    );
    const result = await withAcceptHandling(
      utils.getWhereUsed({
        object_name: 'CL_ABAP_CHAR_UTILITIES',
        object_type: 'class',
        scopeXml: scopeResponse.data, // Pass scope as-is, no modifications
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    const match = result.data?.match(/numberOfResults="(\d+)"/);
    if (match) {
      testsLogger.info?.(
        `🎯 Found ${match[1]} usage references with default scope`,
      );
    }

    testsLogger.info?.('✅ Test complete: scope used without modifications');
  }, 30000);

  it('should search with all types enabled (Eclipse "select all" behavior)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }
    logTestStep('where-used with ALL types enabled', testsLogger);
    testsLogger.info?.('📋 Object: CL_ABAP_CHAR_UTILITIES (class)');
    testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

    const utils = client.getUtils();
    const scopeResponse = await withAcceptHandling(
      utils.getWhereUsedScope({
        object_name: 'CL_ABAP_CHAR_UTILITIES',
        object_type: 'class',
      }),
    );

    expect(scopeResponse.status).toBe(200);

    // Parse initial state
    const allTypes = (scopeResponse.data.match(/<usagereferences:type/g) || [])
      .length;
    const initialSelected = (
      scopeResponse.data.match(/isSelected="true"/g) || []
    ).length;

    testsLogger.info?.(
      `📊 Initial scope: ${initialSelected}/${allTypes} types selected`,
    );

    // Step 2: Enable ALL types (like Eclipse "Select All" checkbox)
    testsLogger.info?.('🔧 Modifying scope - enabling ALL types...');
    const modifiedScope = utils.modifyWhereUsedScope(scopeResponse.data, {
      enableAll: true,
    });

    // Verify all types are now selected
    const finalSelected = (modifiedScope.match(/isSelected="true"/g) || [])
      .length;
    testsLogger.info?.(
      `📊 Modified scope: ${finalSelected}/${allTypes} types selected`,
    );
    expect(finalSelected).toBe(allTypes);

    // Step 3: Execute search with all types
    testsLogger.info?.(
      '🔍 Step 3: Executing where-used search with ALL types...',
    );
    const result = await withAcceptHandling(
      utils.getWhereUsed({
        object_name: 'CL_ABAP_CHAR_UTILITIES',
        object_type: 'class',
        scopeXml: modifiedScope,
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    const match = result.data?.match(/numberOfResults="(\d+)"/);
    if (match) {
      testsLogger.info?.(
        `🎯 Found ${match[1]} usage references with ALL types enabled`,
      );
    }

    testsLogger.info?.('✅ Test complete: all types enabled successfully');
  }, 30000);

  it('should get where-used for table', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    try {
      logTestStep('get where-used for table', testsLogger);
      testsLogger.info?.('📋 Object: T000 (table)');
      testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

      const result = await withAcceptHandling(
        client.getUtils().getWhereUsed({
          object_name: 'T000',
          object_type: 'table',
        }),
      );

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Where-used query completed (default types)');
      testsLogger.info?.(`📊 Response size: ${result.data?.length || 0} bytes`);

      // Parse and log number of results
      const match = result.data?.match(/numberOfResults="(\d+)"/);
      if (match) {
        testsLogger.info?.(`🎯 Found ${match[1]} usage references`);

        // Parse objectTypes to see which types were searched
        const typeMatches = result.data?.matchAll(
          /<usagereferences:type name="([^"]+)" isSelected="true"/g,
        );
        const searchedTypes: string[] = [];
        if (typeMatches) {
          for (const tm of typeMatches) {
            searchedTypes.push(tm[1]);
          }
          testsLogger.info?.(
            `🔍 Searched in types: ${searchedTypes.join(', ')}`,
          );
        }

        // Log result description if available
        const descMatch = result.data?.match(/resultDescription="([^"]+)"/);
        if (descMatch) {
          testsLogger.info?.(`📝 Result: ${descMatch[1]}`);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 415) {
        throw new Error(
          `415 Unsupported Media Type: The server cannot process the request Content-Type. This may indicate an issue with the Content-Type header format. Error: ${error.message}`,
        );
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error(
          `Request timeout: Where-used query for table "T000" exceeded timeout. This may indicate that the query is too complex or the system is slow. Consider increasing the timeout or using a simpler test object. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 60000); // Increased timeout to 60s for table where-used queries which can be slow

  it('should throw error if object name is missing', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('validate error if object name is missing', testsLogger);
    await expect(
      client.getUtils().getWhereUsed({
        object_name: '',
        object_type: 'class',
      }),
    ).rejects.toThrow('Object name is required');
  });

  it('should throw error if object type is missing', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('validate error if object type is missing', testsLogger);
    await expect(
      client.getUtils().getWhereUsed({
        object_name: 'TEST',
        object_type: '',
      }),
    ).rejects.toThrow('Object type is required');
  });
});
