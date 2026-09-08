/**
 * Integration test for ATC check runs (AdtRuntimeClient.getAtc()).
 *
 * **What makes this test worth anything is the object it runs against.**
 * An ATC run over clean code answers `FINDING_STATS "0,0,0"`, and so does a run
 * whose check variant looks for nothing at all — a green test that asserted
 * only "a run finished" would pass identically on a system where ATC checks
 * nothing. So this runs over `ZAC_SHR_ATC_DIRTY`, a shared class that exists to
 * be found in, and it fails when the triple comes back all zeroes.
 *
 * Measured on the BTP trial, 2026-09-08, under the variant the system nominates
 * (`ABAP_CLOUD_DEVELOPMENT_DEFAULT`): one finding, priority 2, SLIN message
 * 0245 "No exception handling after the CATCH statement." — the empty
 * `CATCH cx_root` in that class — and `FINDING_STATS "0,1,0"`. That pairing is
 * also what decodes the triple's second position as priority 2.
 *
 * Both modes are exercised, because they are two different server behaviours
 * rather than a timing preference: `wait: true` holds the request and answers
 * with the triple, while the default answers at once with a run id to poll.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/atc/AtcRun.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
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
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const SECTION = 'atc_run';
const CASE = 'adt_atc_run';

function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.trunc(num);
}

/** The triple as the server sent it, split — the test does the arithmetic. */
function countsOf(findingStats: string): number[] {
  return findingStats.split(',').map((part) => Number(part.trim()));
}

describe('ATC check runs (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails naming the
      // reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it(
    'waits for the run and reports a triple that is not all zeroes',
    async () => {
      const testName = 'AtcRun - wait for the run';
      const testCase = getEnabledTestCase(SECTION, CASE);

      logTestStart(testsLogger, testName, {
        name: CASE,
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          `${SECTION}/${CASE} not configured or disabled in test-config.yaml`,
        );
        return;
      }
      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const className = String(testCase.params.class_name).toUpperCase();

      try {
        logTestStep(`run ATC over class ${className}, waiting`, testsLogger);
        const result = expectResult(
          await runtime
            .getAtc()
            .run(
              { objects: [{ objectType: 'class', objectName: className }] },
              { wait: true },
            ),
          'ATC run',
        );

        // Narrowing on `waited` is how the rest of the shape is reached, and
        // the flag is worth asserting on its own: an answer that did not wait
        // carries no triple at all.
        expect(result.waited).toBe(true);
        if (!result.waited) return;

        expect(result.worklistId).toBeTruthy();
        expect(result.findingStats).toMatch(/^\d+,\d+,\d+$/);

        const counts = countsOf(result.findingStats);
        const total = counts.reduce((sum, n) => sum + n, 0);
        logTestStep(
          `FINDING_STATS ${result.findingStats} (worklist ${result.worklistId})`,
          testsLogger,
        );

        // The assertion this file exists for. A zero triple over an object
        // written to be found in is not a clean class: it is a system whose
        // nominated check variant looks for none of what the class does wrong,
        // and every other assertion here would pass while meaning nothing.
        expect(total).toBeGreaterThan(0);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'polls the run to completion and reads the finding out of the worklist',
    async () => {
      const testName = 'AtcRun - poll and read the worklist';
      const testCase = getEnabledTestCase(SECTION, CASE);

      logTestStart(testsLogger, testName, {
        name: CASE,
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          `${SECTION}/${CASE} not configured or disabled in test-config.yaml`,
        );
        return;
      }
      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const className = String(testCase.params.class_name).toUpperCase();
      const expectedMessageId = String(testCase.params.expected_message_id);
      const expectedPriority = String(testCase.params.expected_priority);
      const deadlineMs = toPositiveInt(
        testCase.params.poll_timeout_ms,
        300_000,
      );
      const intervalMs = toPositiveInt(testCase.params.poll_interval_ms, 3_000);

      try {
        const atc = runtime.getAtc();

        logTestStep(`start ATC run over class ${className}`, testsLogger);
        const started = expectResult(
          await atc.run({
            objects: [{ objectType: 'class', objectName: className }],
          }),
          'ATC run',
        );

        expect(started.waited).toBe(false);
        if (started.waited) return;
        expect(started.runId).toBeTruthy();
        expect(started.worklistId).toBeTruthy();

        // The bound is the caller's to choose — there is no waitForRun helper,
        // and its absence is the library's design rather than an omission.
        logTestStep(`poll run ${started.runId} until it finishes`, testsLogger);
        const giveUpAt = Date.now() + deadlineMs;
        let status = expectResult(
          await atc.getRunStatus(started.runId),
          'ATC run status',
        );
        while (!status.isFinished && Date.now() < giveUpAt) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          status = expectResult(
            await atc.getRunStatus(started.runId),
            'ATC run status',
          );
        }
        // `isFinished` is completion, not success — so this says the run
        // reached an end, and the worklist below says what it found.
        expect(status.isFinished).toBe(true);

        logTestStep(`read worklist ${started.worklistId}`, testsLogger);
        const worklist = expectResult(
          await atc.getFindings(started.worklistId),
          'ATC findings',
        );
        expect(typeof worklist).toBe('string');

        // The worklist lists every object the run checked, clean ones included,
        // so finding the name proves the run covered it and nothing more.
        expect(worklist).toContain(className);

        // What was actually found. Asserted by message rather than by count:
        // the class carries three deliberate violations and only this one is in
        // the variant the system nominates, so a changed number is information
        // and a changed message is a different system.
        expect(worklist).toContain(
          `atcfinding:messageId="${expectedMessageId}"`,
        );
        expect(worklist).toContain(`atcfinding:priority="${expectedPriority}"`);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
