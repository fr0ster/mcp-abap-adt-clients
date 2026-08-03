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
import type { AdtClient } from '../../../clients/AdtClient';
import { parseSearchResults } from '../../../core/shared/search';
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

describe('Shared - searchObjects', () => {
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

  it('should search objects by name pattern', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('search objects by name pattern', testsLogger);
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

    // Parse with the shipped parser rather than a regex. The regex here used to
    // be /<objectReference/, which never matches: SAP prefixes the element,
    // `<adtcore:objectReference`. The count was only logged, never asserted, so
    // it silently found nothing for as long as it existed — and read as
    // evidence that the payload was unprefixed, which it is not.
    const hits = parseSearchResults(String(result.data ?? ''));
    testsLogger.info?.(`🎯 Found ${hits.length} objects`);
    for (const hit of hits) {
      expect(hit.name).toBeTruthy();
      expect(hit.type).toBeTruthy();
    }
  }, 15000);

  it('should search objects with object type filter', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('search objects with object type filter', testsLogger);
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

    // Parse with the shipped parser rather than a regex. The regex here used to
    // be /<objectReference/, which never matches: SAP prefixes the element,
    // `<adtcore:objectReference`. The count was only logged, never asserted, so
    // it silently found nothing for as long as it existed — and read as
    // evidence that the payload was unprefixed, which it is not.
    const hits = parseSearchResults(String(result.data ?? ''));
    testsLogger.info?.(`🎯 Found ${hits.length} tables`);
    for (const hit of hits) {
      expect(hit.name).toBeTruthy();
      expect(hit.type).toBeTruthy();
    }
  }, 15000);

  it('should use default maxResults if not provided', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('search objects with default maxResults', testsLogger);
    const result = await withAcceptHandling(
      client.getUtils().searchObjects({
        query: 'CL_ABAP*',
      }),
    );
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);
});
