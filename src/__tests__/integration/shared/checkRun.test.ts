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
 * A third shape is possible and is not asserted here: an authorization refusal
 * naming `S_ABPLNGVS`, the ABAP **language version**, which newer systems raise
 * when the version the sent source implies cannot be satisfied — including for
 * reasons that have nothing to do with rights (see TROUBLESHOOTING.md). It can
 * arrive as a transport failure or as an exception document inside a 200, so it
 * is recognised and skipped with the server's own sentence rather than reported
 * as a contract violation.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/checkRun
 */

import type {
  IAbapConnection,
  IAdtError,
  IAnalyse,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../clients/AdtClient';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

/** A name no system has, so the answer is about the address and nothing else. */
const NEVER_EXISTS = 'ZAC_NO_SUCH_CLASS_ZZ';

const statusOf = (report: string): string =>
  /chkrun:status="([^"]*)"/.exec(report)?.[1] ?? '';

const statusTextOf = (report: string): string =>
  /chkrun:statusText="([^"]*)"/.exec(report)?.[1] ?? '';

const messageCountOf = (report: string): number =>
  (report.match(/<chkrun:checkMessage[\s>]/g) ?? []).length;

/**
 * The language-version refusal, in either shape it arrives in.
 *
 * Not a contract failure: the server is declining to check at all, and on a
 * system where the SACF scenario is off this never appears.
 */
const isLanguageVersionRefusal = (text: string): boolean =>
  /S_ABPLNGVS|ExceptionResourceNoAccess/.test(text);

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

describe('Shared - what check answers', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
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
      hasConfig = true;

      const resolver = new TestConfigResolver({
        isCloud: false,
        isLegacy,
        logger: testsLogger,
        handlerName: 'read_source',
        testCaseName: 'read_class_source',
      });
      className = resolver.getObjectName('class_name', 'class') ?? undefined;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  const ready = (): boolean => hasConfig && Boolean(className);

  it('answers a report, and the report says the check happened', async () => {
    if (!ready()) {
      logTestSkip(testsLogger, 'check — stored source', 'No class configured');
      return;
    }
    logTestStep(`check ${className} as stored`, testsLogger);

    const answer = await client.getClass().check({ className }, 'active');

    // `ok` first, but it is not the assertion — it only says there is a
    // document to read.
    expect(answer.ok).toBe(true);
    if (!answer.ok) {
      throw new Error(answer.getError().message);
    }
    const report = String(answer.getResult().value ?? '');
    testsLogger.info?.(
      `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
    );

    if (isLanguageVersionRefusal(report)) {
      logTestSkip(
        testsLogger,
        'check — stored source',
        `the server declined on the ABAP language version: ${statusTextOf(report) || report.slice(0, 200)}`,
      );
      return;
    }

    // The assertion. `notProcessed` carries no messages either, so counting
    // them would call a refusal a clean check.
    expect(statusOf(report)).toBe('processed');
  }, 60000);

  /**
   * The assertion the release exists for.
   *
   * Source that cannot compile used to arrive as a thrown error with the report
   * discarded. It arrives as a success carrying the report, and the report names
   * what is wrong.
   */
  it('reports the findings for source that cannot compile, rather than raising', async () => {
    if (!ready()) {
      logTestSkip(testsLogger, 'check — broken source', 'No class configured');
      return;
    }
    logTestStep(
      `check ${className} against source that cannot compile`,
      testsLogger,
    );

    const answer = await client
      .getClass()
      .check({ className, sourceCode: BROKEN_SOURCE }, 'inactive');

    if (!answer.ok) {
      const message = answer.getError().message;
      if (isLanguageVersionRefusal(message)) {
        logTestSkip(
          testsLogger,
          'check — broken source',
          `the server declined on the ABAP language version: ${message.slice(0, 200)}`,
        );
        return;
      }
      throw new Error(message);
    }

    const report = String(answer.getResult().value ?? '');
    testsLogger.info?.(
      `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
    );

    if (isLanguageVersionRefusal(report)) {
      logTestSkip(
        testsLogger,
        'check — broken source',
        `the server declined on the ABAP language version: ${statusTextOf(report) || report.slice(0, 200)}`,
      );
      return;
    }

    // The check ran, and it found something. Both halves matter: `processed`
    // without findings would mean the source never reached the checker, and
    // findings are what the throw used to discard.
    expect(statusOf(report)).toBe('processed');
    expect(messageCountOf(report)).toBeGreaterThan(0);
  }, 60000);

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
  it('answers notProcessed for an object that is not there, with no messages', async () => {
    if (!hasConfig) {
      logTestSkip(testsLogger, 'check — absent object', 'No SAP configuration');
      return;
    }
    logTestStep(`check ${NEVER_EXISTS}, which does not exist`, testsLogger);

    const answer = await client
      .getClass()
      .check({ className: NEVER_EXISTS }, 'active');

    if (!answer.ok) {
      const message = answer.getError().message;
      if (isLanguageVersionRefusal(message)) {
        logTestSkip(
          testsLogger,
          'check — absent object',
          `the server declined on the ABAP language version: ${message.slice(0, 200)}`,
        );
        return;
      }
      throw new Error(message);
    }

    const report = String(answer.getResult().value ?? '');
    testsLogger.info?.(
      `status=${statusOf(report)} text=${statusTextOf(report)} messages=${messageCountOf(report)}`,
    );

    if (isLanguageVersionRefusal(report)) {
      logTestSkip(
        testsLogger,
        'check — absent object',
        `the server declined on the ABAP language version: ${statusTextOf(report) || report.slice(0, 200)}`,
      );
      return;
    }

    expect(statusOf(report)).toBe('notProcessed');
    // The half that makes counting messages unsafe.
    expect(messageCountOf(report)).toBe(0);
  }, 60000);

  /**
   * And the other half of the contract: the verdict is the caller's, supplied
   * per call. The same exchange becomes a failure because this caller said so.
   */
  it('becomes a failure when the caller says a finding is one', async () => {
    if (!ready()) {
      logTestSkip(testsLogger, 'check — caller verdict', 'No class configured');
      return;
    }
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
      .check({ className, sourceCode: BROKEN_SOURCE }, 'inactive', {
        analyse: everythingIsAFailure,
      });

    expect(judged.ok).toBe(false);
    if (judged.ok) throw new Error('the strategy was not consulted');
    const failure = judged.getError();
    expect(failure.origin).toBe('refusal');
    // The document reached the strategy, rather than a summary of it.
    expect(failure.message).toContain('chkrun:');

    // Recorded beside it rather than asserted, because it is a fact about the
    // server: a strategy that reads severity finds this source an error.
    // Measured 2026-09-12 — the same exchange came back a failure.
    const bySeverity: IAnalyse<IAdtError> = (verdict, wire) => {
      const document = String(wire?.data ?? '');
      return /type="E"/.test(document)
        ? { origin: 'refusal', message: document }
        : verdict;
    };
    const realistic = await client
      .getClass()
      .check({ className, sourceCode: BROKEN_SOURCE }, 'inactive', {
        analyse: bySeverity,
      });
    testsLogger.info?.(
      `a severity-reading strategy called it: ${realistic.ok ? 'no failure' : 'a failure'}`,
    );
  }, 60000);
});
