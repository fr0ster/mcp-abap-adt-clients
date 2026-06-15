/**
 * Integration test for listFunctionGroupIncludes shared function.
 * Tests AdtUtils.listFunctionGroupIncludes against a real SAP system using the
 * shared polygon function group (ZAC_SHR_FUGR -> LZAC_SHR_FUGRTOP / ...UXX).
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/shared/functionGroupIncludesList.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { createTestAdtClient } from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

// Shared dependency objects (created via `npm run shared:setup`).
const SHARED_FUNCTION_GROUP = 'ZAC_SHR_FUGR';
// The generated TOP include is always present for a function group.
const EXPECTED_TOP_INCLUDE = 'LZAC_SHR_FUGRTOP';

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

describe('Shared - listFunctionGroupIncludes', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolvedClient;
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

  it('lists the includes of the shared function group', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep(
      `listFunctionGroupIncludes(${SHARED_FUNCTION_GROUP})`,
      testsLogger,
    );

    const result = await client
      .getUtils()
      .listFunctionGroupIncludes(SHARED_FUNCTION_GROUP);

    testsLogger.info?.(`🎯 Includes: ${JSON.stringify(result)}`);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const inc of result) {
      expect(typeof inc).toBe('string');
      expect(inc.length).toBeGreaterThan(0);
    }
    // The generated TOP include must be present (case-insensitive).
    const upper = result.map((inc) => inc.toUpperCase());
    expect(upper).toContain(EXPECTED_TOP_INCLUDE.toUpperCase());
    // No duplicates (deduped by uppercased key).
    expect(new Set(upper).size).toBe(upper.length);
  }, 30000);
});
