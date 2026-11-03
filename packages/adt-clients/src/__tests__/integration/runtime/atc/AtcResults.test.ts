/**
 * Integration test for the ATC results by Display ID
 * (AdtAtc.listResults, AdtAtc.getResult).
 *
 * Read-only: one GET of `/atc/results` and one of `/atc/results/{displayId}`.
 * What it holds the system to is what was measured (on premise and on the
 * cloud, 2026-11-02): the central results of every user (`createdBy: '*'`)
 * of the last ten years list at least one result, and that result read by its
 * Display ID answers a list holding it. The ages are stated: without them SAP
 * applies a window of its own, which listed 26 central results on premise one
 * day and none the next (2026-11-02, 2026-11-03).
 *
 * Run: npm test -- src/__tests__/integration/runtime/atc/AtcResults.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtAtc, atcDocuments } from '../../../../runtime/atc/AdtAtc';
import type { ResultValuesOf } from '../../../../utils/resultStrategy';
import { gate } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { logTestStep } from '../../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

// Disabled in test-config.yaml, or no SAP: registered as skipped.
const resultsCase = gate('atc_run', 'adt_atc_results');

const OPEN = '<atcresult:displayId>';
const CLOSE = '</atcresult:displayId>';

/** Every Display ID in an `atcresult:resultList`, in document order. */
function displayIdsOf(document: string): string[] {
  const ids: string[] = [];
  let at = document.indexOf(OPEN);
  while (at !== -1) {
    const start = at + OPEN.length;
    const end = document.indexOf(CLOSE, start);
    if (end === -1) break;
    ids.push(document.slice(start, end));
    at = document.indexOf(OPEN, end);
  }
  return ids;
}

describe('ATC results (AdtAtc.listResults, AdtAtc.getResult)', () => {
  let connection: IAbapConnection | undefined;
  let atc: AdtAtc<ResultValuesOf<typeof atcDocuments>>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      throw error;
    }
    atc = new AdtAtc(connection, {
      logger: libraryLogger,
      results: atcDocuments,
    });
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  resultsCase(
    'lists the central results of every user and reads the first by its Display ID',
    async () => {
      const list = expectResult(
        await atc.listResults({
          createdBy: '*',
          centralOnly: true,
          ageMin: 0,
          ageMax: 3650,
          analyse: analyseException,
        }),
        'result list',
      );
      const ids = displayIdsOf(list);
      logTestStep(`${ids.length} central ATC results`, testsLogger);
      expect(ids.length).toBeGreaterThan(0);

      const [first] = ids;
      if (first === undefined) throw new Error('the list holds no result');
      const one = expectResult(
        await atc.getResult(first, { analyse: analyseException }),
        'result',
      );
      expect(displayIdsOf(one)).toEqual([first]);
      expect(one).toContain('<atcresult:objects');
    },
  );
});
