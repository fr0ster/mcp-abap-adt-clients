/**
 * Unit test for searchObjects shared function
 * Tests searchObjects function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/search.test
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
import type { ISearchResult } from '../../../core/shared/utilResults';
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

describe('Shared - searchObjects', () => {
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

  it('should search objects by name pattern', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    logTestStep('search objects by name pattern', testsLogger);
    testsLogger.info?.('🔍 Query: CL_ABAP*, maxResults: 10');

    // The shipped reading answers the hits, so there is no document to parse
    // here any more — the regex this used to run was /<objectReference/, which
    // never matches, because SAP prefixes the element. It was only logged,
    // never asserted, so it found nothing for as long as it existed.
    const hits = expectResult(
      await withAcceptHandling(
        client.getUtils().search({ query: 'CL_ABAP*', maxResults: 10 }),
      ),
      'search CL_ABAP*',
    ) as ISearchResult[];

    testsLogger.info?.('✅ Search completed');
    testsLogger.info?.(`🎯 Found ${hits.length} objects`);
    // Assert the count FIRST. Asserting only inside the loop is how the old
    // regex failed: on an empty result no assertion runs and the test passes,
    // so a wrong namespace or a broken parser reads as success.
    expect(hits.length).toBeGreaterThan(0);
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

    const hits = expectResult(
      await withAcceptHandling(
        client
          .getUtils()
          .search({ query: 'T*', objectType: 'TABL', maxResults: 10 }),
      ),
      'search tables',
    ) as ISearchResult[];

    testsLogger.info?.('✅ Search completed');
    testsLogger.info?.(`🎯 Found ${hits.length} tables`);
    // Assert the count FIRST. Asserting only inside the loop is how the old
    // regex failed: on an empty result no assertion runs and the test passes,
    // so a wrong namespace or a broken parser reads as success.
    expect(hits.length).toBeGreaterThan(0);
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
    const hits = expectResult(
      await withAcceptHandling(client.getUtils().search({ query: 'CL_ABAP*' })),
      'search without maxResults',
    ) as ISearchResult[];

    // No `maxResults` is still a search, and the answer is still the hits.
    expect(Array.isArray(hits)).toBe(true);
  }, 15000);
});
