/**
 * Unit test for searchObjects shared function
 * Tests searchObjects function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/search.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// The source path, not the package: these readings are new in adt-strategies
// and the package's built entry point does not carry them until it is released.
import {
  analyseException,
  type ISearchResult,
  utilSearchHits,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { gateOn } from '../../helpers/caseGate';
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

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      // The connector refuses work on a connection nobody opened; these files
      // predate that contract and never noticed, because they were skipping.
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolvedClient;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  // The hits are a reading the caller asks for; the shipped default is the
  // document as it came.
  const hitsUtils = () =>
    client.getUtils({ ...utilDocuments, search: utilSearchHits });

  gateOn(() => true)(
    'should search objects by name pattern',
    async () => {
      logTestStep('search objects by name pattern', testsLogger);
      testsLogger.info?.('🔍 Query: CL_ABAP*, maxResults: 10');

      // The hits come from `utilSearchHits`, passed as the reading — the default
      // answers the document. There is no document to parse here — the regex this used to run was /<objectReference/, which
      // never matches, because SAP prefixes the element. It was only logged,
      // never asserted, so it found nothing for as long as it existed.
      const hits = expectResult(
        await withAcceptHandling(
          hitsUtils().search(
            { query: 'CL_ABAP*', maxResults: 10 },
            { analyse: analyseException },
          ),
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
    },
    15000,
  );

  gateOn(() => true)(
    'should search objects with object type filter',
    async () => {
      logTestStep('search objects with object type filter', testsLogger);
      testsLogger.info?.('🔍 Query: T*, objectType: TABL/DT, maxResults: 10');

      const hits = expectResult(
        await withAcceptHandling(
          hitsUtils().search(
            {
              query: 'T*',
              objectType: 'TABL/DT',
              maxResults: 10,
            },
            { analyse: analyseException },
          ),
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
    },
    15000,
  );

  gateOn(() => true)(
    'should use default maxResults if not provided',
    async () => {
      logTestStep('search objects with default maxResults', testsLogger);
      const hits = expectResult(
        await withAcceptHandling(
          hitsUtils().search(
            { query: 'CL_ABAP*' },
            { analyse: analyseException },
          ),
        ),
        'search without maxResults',
      ) as ISearchResult[];

      // No `maxResults` is still a search, and the answer is still the hits.
      expect(Array.isArray(hits)).toBe(true);
    },
    15000,
  );
});
