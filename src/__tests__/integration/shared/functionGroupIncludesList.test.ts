/**
 * Integration test for listFunctionGroupIncludes shared function.
 * Tests AdtUtils.listFunctionGroupIncludes against a real SAP system using the
 * shared polygon function group (ZAC_SHR_FUGR -> LZAC_SHR_FUGRTOP / ...UXX).
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/shared/functionGroupIncludesList.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import {
  createTestAdtClient,
  createTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
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

describe('Shared - listFunctionGroupIncludes', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      // The connector refuses work on a connection nobody opened; these files
      // predate that contract and never noticed, because they were skipping.
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolvedClient;
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterEach(async () => {
    if (connection) {
      await connection.disconnect();
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
