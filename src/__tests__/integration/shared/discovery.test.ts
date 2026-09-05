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
  IAdtResponse,
  IAdtResult,
  IAdtWireResponse,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
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

  beforeAll(async () => {
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

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
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

    // The verdict comes from the contract, not from the status: ADT answers a
    // refusal inside a 200, so `status === 200` would pass over one.
    // `withAcceptHandling` comes from a `require`d JS helper and returns `any`,
    // so the contract has to be named here or the assertions below type as
    // `unknown` and stop checking anything.
    const answer = (await withAcceptHandling(
      client.getUtils().discovery(),
    )) as IAdtResponse<string>;
    const xml = expectResult(answer, 'discovery');
    expect(xml.length).toBeGreaterThan(0);
    expect(xml).toMatch(/<app:service|<service/);

    testsLogger.info?.('✅ Discovery fetched');
    testsLogger.info?.(`📊 Response size: ${xml.length} bytes`);
  }, 15000);
});
