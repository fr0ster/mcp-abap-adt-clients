/**
 * What `check` answers — the release changed it, and nothing was watching.
 *
 * Eighteen `check.ts` modules used to parse the report, decide it meant failure,
 * and raise. The throw cost the findings, the line numbers and the T100 keys —
 * everything a caller would act on. Since 19.0.0 a check that finds a syntax
 * error is a check that **worked**: the report comes back inside a success, and
 * whether a message means "do not write" is the caller's, through `analyse`.
 *
 * No integration test exercised `check` on any type before this one, which is
 * how a behaviour change across eighteen modules shipped unwatched.
 *
 * **Nothing here reads `ok` as "the check happened".** `ok` says an exchange
 * completed and a reading produced a value; it says nothing about what the
 * server did. Measured by this file, 2026-09-12:
 *
 * | asked about | `chkrun:status` | `chkrun:statusText` | messages |
 * |---|---|---|---|
 * | a stored class | `processed` | `Object … has been checked` | 0 |
 * | source that cannot compile | `processed` | `Object … has been checked` | 1 |
 * | a class that does not exist | `notProcessed` | `Resource CLASS … does not exist.` | 0 |
 *
 * All three are HTTP 200 and all three are `ok`. The first and the third are
 * **identical** by status code and by message count: a clean check and an
 * object that is not there. Only `chkrun:status` separates them.
 *
 * That is the whole argument for injecting the reading and the verdict rather
 * than assuming them, so this file reads the status too.
 *
 * A refusal — an authorization refusal naming `S_ABPLNGVS`, the ABAP
 * **language version**, included — can arrive as a returned failure or as an
 * exception document inside a 200. Both fail the test with what SAP said
 * (`expectCheckReport`). Whether these checks can run on a system is the
 * configuration's to say, through the cases' `enabled` / `available_in`;
 * a refusal is never read as "not available here".
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/checkRun
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAdtError, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtClient } from '../../../clients/AdtClient';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { gate, gateAll, gateOn } from '../../helpers/caseGate';
import { expectCheckReport } from '../../helpers/checkReport';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

/** A name no system has, so the answer is about the address and nothing else. */
const NEVER_EXISTS = 'ZAC_NO_SUCH_CLASS_ZZ';

const statusOf = (report: string): string =>
  /chkrun:status="([^"]*)"/.exec(report)?.[1] ?? '';

const statusTextOf = (report: string): string =>
  /chkrun:statusText="([^"]*)"/.exec(report)?.[1] ?? '';

const messageCountOf = (report: string): number =>
  (report.match(/<chkrun:checkMessage[\s>]/g) ?? []).length;

/** ABAP that cannot compile, so the server has findings to report. */
const BROKEN_SOURCE = `CLASS zac_shr_broken DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS broken.
ENDCLASS.

CLASS zac_shr_broken IMPLEMENTATION.
  METHOD broken.
    THIS IS NOT ABAP AT ALL.
  ENDMETHOD.
ENDCLASS.`;

/** The configured class the checks run against, if there is one. */
function configuredClassName(isLegacy: boolean): string | undefined {
  return (
    new TestConfigResolver({
      isCloud: false,
      isLegacy,
      logger: testsLogger,
      handlerName: 'read_source',
      testCaseName: 'read_class_source',
    }).getObjectName('class_name', 'class') ?? undefined
  );
}

// Whether `check` runs on this system is check_run/class_check's `enabled` /
// `available_in`: a refusal fails, it is never read as "not available here".
const checkCase = gate('check_run', 'class_check');
// Applies where the case is on and a class is configured to check.
const withClass = gateAll(
  checkCase,
  gateOn(({ isLegacy }) => !!configuredClassName(isLegacy)),
);

describe('Shared - what check answers', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isLegacy = false;
  let className: string | undefined;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved, isLegacy: legacy } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
      isLegacy = legacy;

      className = configuredClassName(isLegacy);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  withClass(
    'answers a report, and the report says the check happened',
    async () => {
      logTestStep(`check ${className} as stored`, testsLogger);

      const answer = await client.getClass().check({ className }, 'active', {
        analyse: analyseException,
        headers: integrationHeadersOf(client.getClass(), 'check'),
      });

      // `ok` first, but it is not the assertion — it only says there is a
      // document to read. A refusal, in either shape, fails here.
      const report = expectCheckReport(answer, 'check the stored class');
      testsLogger.info?.(
        `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
      );

      // The assertion. `notProcessed` carries no messages either, so counting
      // them would call a refusal a clean check.
      expect(statusOf(report)).toBe('processed');
    },
    60000,
  );

  /**
   * The assertion the release exists for.
   *
   * Source that cannot compile used to arrive as a thrown error with the report
   * discarded. It arrives as a success carrying the report, and the report names
   * what is wrong.
   */
  withClass(
    'reports the findings for source that cannot compile, rather than raising',
    async () => {
      logTestStep(
        `check ${className} against source that cannot compile`,
        testsLogger,
      );

      const answer = await client
        .getClass()
        .check({ className, source: BROKEN_SOURCE }, 'inactive', {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getClass(), 'check'),
        });

      // A refusal, in either shape, fails here with what SAP said.
      const report = expectCheckReport(answer, 'check — broken source');
      testsLogger.info?.(
        `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
      );

      // The check ran, and it found something. Both halves matter: `processed`
      // without findings would mean the source never reached the checker, and
      // findings are what the throw used to discard.
      expect(statusOf(report)).toBe('processed');
      expect(messageCountOf(report)).toBeGreaterThan(0);
    },
    60000,
  );

  /**
   * The trap, stated as a test.
   *
   * A check of an object that is not there answers HTTP 200, `ok` is true, and
   * the report carries **no messages** — identical to a clean check by every
   * measure except `chkrun:status`. Recorded in the response corpus:
   * `notProcessed`, `Resource CLASS … does not exist.`
   *
   * This is why the verdict is injected. A member that counted messages would
   * have reported this object as compiling cleanly.
   */
  checkCase(
    'answers notProcessed for an object that is not there, with no messages',
    async () => {
      logTestStep(`check ${NEVER_EXISTS}, which does not exist`, testsLogger);

      const answer = await client
        .getClass()
        .check({ className: NEVER_EXISTS }, 'active', {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getClass(), 'check'),
        });

      // A refusal, in either shape, fails here with what SAP said.
      const report = expectCheckReport(answer, 'check — absent object');
      testsLogger.info?.(
        `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
      );

      expect(statusOf(report)).toBe('notProcessed');
      // The half that makes counting messages unsafe.
      expect(messageCountOf(report)).toBe(0);
    },
    60000,
  );

  /**
   * And the other half of the contract: the verdict is the caller's, supplied
   * per call. The same exchange becomes a failure because this caller said so.
   */
  withClass(
    'becomes a failure when the caller says a finding is one',
    async () => {
      logTestStep('check with the caller supplying analyse', testsLogger);

      // Deliberately unconditional. A strategy that reads severity would tie this
      // assertion to whether the server marks a finding `type="E"` — a property of
      // the server, not of the contract — and the test would then fail for a
      // reason unrelated to the mechanism it exists to protect. What must hold is
      // that the strategy is consulted at all.
      const everythingIsAFailure: IAnalyse<IAdtError> = (_verdict, wire) => ({
        origin: 'refusal',
        message: String(wire?.data ?? '(no document)'),
      });

      const judged = await client
        .getClass()
        .check({ className, source: BROKEN_SOURCE }, 'inactive', {
          headers: integrationHeadersOf(client.getClass(), 'check'),
          analyse: everythingIsAFailure,
        });

      expect(judged.ok).toBe(false);
      if (judged.ok) throw new Error('the strategy was not consulted');
      const failure = judged.getError();
      expect(failure.origin).toBe('refusal');
      // The document reached the strategy, rather than a summary of it.
      expect(failure.message).toContain('chkrun:');
    },
    60000,
  );
});
