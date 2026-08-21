/**
 * Integration test for ADT discovery shared function
 * Tests discovery endpoint using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/shared/discovery.test
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

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - discovery', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;

  beforeEach(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      // The connector refuses work on a connection nobody opened; these files
      // predate that contract and never noticed, because they were skipping.
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
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
