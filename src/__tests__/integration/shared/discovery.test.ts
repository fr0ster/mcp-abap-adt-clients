/**
 * Integration test for ADT discovery shared function
 * Tests discovery endpoint using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/shared/discovery.test
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

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - discovery', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      // The connector refuses work on a connection nobody opened; these files
      // predate that contract and never noticed, because they were skipping.
      await (connection as any).connect();
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
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

  it('should fetch ADT discovery document', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('fetch ADT discovery document', testsLogger);

    const result = await withAcceptHandling(client.getUtils().discovery());

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    const xml = String(result.data);
    expect(xml.length).toBeGreaterThan(0);
    expect(xml).toMatch(/<app:service|<service/);

    testsLogger.info?.('✅ Discovery fetched');
    testsLogger.info?.(`📊 Response size: ${xml.length} bytes`);
  }, 15000);
});
