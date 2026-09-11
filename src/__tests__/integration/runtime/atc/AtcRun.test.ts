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

/**
 * The polling bound the case configures, and a jest timeout that clears it.
 *
 * `getTimeout('test')` reads `test_settings.timeouts.test`, which the shipped
 * template does not define — so on a fresh machine it falls back to 60s while
 * this case asks to poll for five minutes. The test would be killed at a
 * minute, never reaching its own deadline, and the failure would read as a
 * hung run rather than as a bound nobody could have met.
 */
const CASE_PARAMS: Record<string, unknown> =
  getEnabledTestCase(SECTION, CASE)?.params ?? {};
const POLL_TIMEOUT_MS = toPositiveInt(CASE_PARAMS.poll_timeout_ms, 300_000);
const POLL_INTERVAL_MS = toPositiveInt(CASE_PARAMS.poll_interval_ms, 3_000);
/** The deadline plus room for the run, the reads and the connection. */
const JEST_TIMEOUT = Math.max(getTimeout('test'), POLL_TIMEOUT_MS + 120_000);

function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.trunc(num);
}

/** The triple as the server sent it, split — the test does the arithmetic. */
function countsOf(findingStats: string): number[] {
  return findingStats.split(',').map((part) => Number(part.trim()));
}

/**
 * The finding elements belonging to one object, as raw start tags.
 *
 * Scoped to the object rather than searched for across the document, and kept
 * as whole elements rather than reduced to attributes: a worklist lists every
 * object a run covered, and each finding carries its own message and priority.
 * Two independent searches over the whole text would accept a document where
 * the expected message sits on one finding and the expected priority on
 * another — which is exactly the regression this test claims to catch.
 */
function findingsFor(worklist: string, objectName: string): string[] {
  const object = new RegExp(
    `<atcobject:object[^>]*adtcore:name="${objectName}"[\\s\\S]*?</atcobject:object>`,
  ).exec(worklist);
  if (!object) return [];
  return object[0].match(/<atcfinding:finding[^>]*/g) ?? [];
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
        // Three calls since 19.0.0, because a run is three requests: the
        // system's check variant, a worklist for it, then the run.
        const atc = runtime.getAtc();
        const variant = await atc.resolveCheckVariant();
        const worklistId = await atc.createWorklist(variant);
        const result = expectResult(
          await atc.startRun(
            worklistId,
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
    JEST_TIMEOUT,
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
      // Absent is a legitimate configuration — see the assertion below — but
      // half of it is not. With only the message the search looks for
      // `priority=""`, matches nothing and fails naming nothing; with only the
      // priority the whole check is skipped in silence and the run goes green
      // having verified less than its configuration asked for. Neither failure
      // says what is wrong, so the pair is refused here, by name.
      const hasMessageId = testCase.params.expected_message_id !== undefined;
      const hasPriority = testCase.params.expected_priority !== undefined;
      if (hasMessageId !== hasPriority) {
        throw new Error(
          `${SECTION}/${CASE}: expected_message_id and expected_priority pin ` +
            'one finding together, so set both or neither — got ' +
            `expected_message_id=${hasMessageId ? 'set' : 'unset'}, ` +
            `expected_priority=${hasPriority ? 'set' : 'unset'}.`,
        );
      }
      const expectedMessageId = hasMessageId
        ? String(testCase.params.expected_message_id)
        : '';
      const expectedPriority = hasPriority
        ? String(testCase.params.expected_priority)
        : '';
      const deadlineMs = POLL_TIMEOUT_MS;
      const intervalMs = POLL_INTERVAL_MS;

      try {
        const atc = runtime.getAtc();

        logTestStep(`start ATC run over class ${className}`, testsLogger);
        const variant = await atc.resolveCheckVariant();
        const worklistId = await atc.createWorklist(variant);
        const started = expectResult(
          await atc.startRun(worklistId, {
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

        // What it found ON OUR OBJECT. This assertion is the system-independent
        // one and it is never conditional: whatever a system's nominated
        // variant checks, a class written to be found in must produce a finding.
        const findings = findingsFor(worklist, className);
        testsLogger.info(
          `${className}: ${findings.length} finding(s) — ${findings
            .map(
              (f) =>
                `${/atcfinding:messageId="([^"]*)"/.exec(f)?.[1] ?? '?'}` +
                `@p${/atcfinding:priority="([^"]*)"/.exec(f)?.[1] ?? '?'}`,
            )
            .join(', ')}`,
        );
        expect(findings.length).toBeGreaterThan(0);

        // And which finding, where the case says so. Optional because the
        // answer belongs to the system's check variant, not to this library:
        // the trial's ABAP_CLOUD_DEVELOPMENT_DEFAULT reports 0245 at priority 2
        // for the empty CATCH, and another system's variant may legitimately
        // report something else. Both attributes must sit on ONE finding, and
        // the line above logs what was seen — so filling this in is a copy.
        if (expectedMessageId) {
          const match = findings.find(
            (finding) =>
              finding.includes(`atcfinding:messageId="${expectedMessageId}"`) &&
              finding.includes(`atcfinding:priority="${expectedPriority}"`),
          );
          expect(match).toBeDefined();
        }

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    JEST_TIMEOUT,
  );
});
