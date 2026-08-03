/**
 * Integration test for listFunctionModules shared function.
 * Tests AdtUtils.listFunctionModules against a real SAP system using the
 * shared polygon function group (ZAC_SHR_FUGR -> Z_AC_SHR_FM01).
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/shared/functionModulesList.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection, type SapConfig } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { createTestAdtClient, getConfig } from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

// Shared dependency objects (created via `npm run shared:setup`).
const SHARED_FUNCTION_GROUP = 'ZAC_SHR_FUGR';
const SHARED_FUNCTION_MODULE = 'Z_AC_SHR_FM01';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - listFunctionModules', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      // The connector refuses work on a connection nobody opened; these files
      // predate that contract and never noticed, because they were skipping.
      await (connection as any).connect();
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

  it('lists the function modules of the shared function group', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep(`listFunctionModules(${SHARED_FUNCTION_GROUP})`, testsLogger);

    const result = await client
      .getUtils()
      .listFunctionModules(SHARED_FUNCTION_GROUP);

    testsLogger.info?.(`🎯 Function modules: ${JSON.stringify(result)}`);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Every entry must be a non-empty string.
    for (const fm of result) {
      expect(typeof fm).toBe('string');
      expect(fm.length).toBeGreaterThan(0);
    }
    // The shared polygon module must be present (case-insensitive).
    const upper = result.map((fm) => fm.toUpperCase());
    expect(upper).toContain(SHARED_FUNCTION_MODULE.toUpperCase());
    // No duplicates (deduped by uppercased key).
    expect(new Set(upper).size).toBe(upper.length);
  }, 30000);

  it('is case-insensitive on the function group name', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep(
      `listFunctionModules(${SHARED_FUNCTION_GROUP.toLowerCase()})`,
      testsLogger,
    );

    const result = await client
      .getUtils()
      .listFunctionModules(SHARED_FUNCTION_GROUP.toLowerCase());

    const upper = result.map((fm) => fm.toUpperCase());
    expect(upper).toContain(SHARED_FUNCTION_MODULE.toUpperCase());
  }, 30000);
});
