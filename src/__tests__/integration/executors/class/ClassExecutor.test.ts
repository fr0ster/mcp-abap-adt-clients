/**
 * Integration test for ClassExecutor
 * Tests class execution with and without profiling using AdtExecutor.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import type { IProfilerTraceParameters } from '../../../../runtime/traces';
import { resolveRunnableClassName } from '../../../helpers/runnableClassHelper';
import {
  createTestAdtClient,
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
import { traceIdsNow, waitForNewTrace } from '../../../helpers/traceHelpers';

const {
  getEnabledTestCase,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

function toBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function toShortText(value: unknown, maxLength: number = 140): string {
  const text =
    typeof value === 'string' ? value : value == null ? '' : String(value);
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, maxLength)}...`;
}

function isMissingClassRunMainMessage(value: unknown): boolean {
  return /does not implement if_oo_adt_classrun~main method/i.test(
    String(value ?? ''),
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function expectRunnableRunOutput(runOutput: string): void {
  expect(runOutput).not.toMatch(
    /does not implement if_oo_adt_classrun~main method/i,
  );
  expect(runOutput).toMatch(/run_probe\(\s*\)/i);
}

function buildProfilerParameters(
  raw: unknown,
): IProfilerTraceParameters | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const data = raw as Record<string, unknown>;
  return {
    allMiscAbapStatements: toBoolean(
      data.all_misc_abap_statements ?? data.allMiscAbapStatements,
    ),
    allProceduralUnits: toBoolean(
      data.all_procedural_units ?? data.allProceduralUnits,
    ),
    allInternalTableEvents: toBoolean(
      data.all_internal_table_events ?? data.allInternalTableEvents,
    ),
    allDynproEvents: toBoolean(data.all_dynpro_events ?? data.allDynproEvents),
    description:
      typeof data.description === 'string' ? data.description : undefined,
    aggregate: toBoolean(data.aggregate),
    explicitOnOff: toBoolean(data.explicit_on_off ?? data.explicitOnOff),
    withRfcTracing: toBoolean(data.with_rfc_tracing ?? data.withRfcTracing),
    allSystemKernelEvents: toBoolean(
      data.all_system_kernel_events ?? data.allSystemKernelEvents,
    ),
    sqlTrace: toBoolean(data.sql_trace ?? data.sqlTrace),
    allDbEvents: toBoolean(data.all_db_events ?? data.allDbEvents),
    maxSizeForTraceFile: toNumber(
      data.max_size_for_trace_file ?? data.maxSizeForTraceFile,
    ),
    amdpTrace: toBoolean(data.amdp_trace ?? data.amdpTrace),
    maxTimeForTracing: toNumber(
      data.max_time_for_tracing ?? data.maxTimeForTracing,
    ),
  };
}

describe('ClassExecutor (integration)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let executor: AdtExecutor;
  let runtimeClient: AdtRuntimeClient;
  let hasConfig = false;
  let isLegacy = false;
  /** Trace ids this file produced, deleted at teardown. */
  const tracesCreated: string[] = [];

  const connectionLogger: ILogger = createConnectionLogger();
  const libraryLogger: ILogger = createLibraryLogger();
  const testsLogger: ILogger = createTestsLogger();

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger);
      client = resolvedClient;
      isLegacy = legacy;
      executor = new AdtExecutor(connection, libraryLogger);
      runtimeClient = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  // No object cleanup: this suite creates none now. The class it runs is a
  // shared, read-only fixture that outlives every run. Traces are the one thing
  // it still produces, and those it removes.
  afterAll(async () => {
    // Traces this run produced. `delete()` exists since 15.0.0 and this is the
    // first place that needed it: a profiled run wrote a trace and nothing ever
    // removed it, so the feed grew by one per run forever.
    //
    // Only ids resolved by `waitForNewTrace` are deleted — they are provably
    // ours, being the newest entry absent before the run. Nothing is swept by
    // diffing the feed again at teardown: on a shared system a trace that
    // appeared in between belongs to somebody else. The retry path can leave a
    // trace from its first attempt untracked, and that is the trade taken
    // knowingly rather than risk deleting a stranger's.
    for (const traceId of tracesCreated) {
      try {
        await runtimeClient.getProfiler().delete(traceId);
      } catch (cleanupError) {
        testsLogger.warn?.(
          `⚠️ Cleanup failed for trace ${traceId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  /**
   * The shared runnable class, not one built for the occasion.
   *
   * `ZAC_SHR_RUN01` exists for exactly this — its config entry says "Shared
   * runnable class (if_oo_adt_classrun) for profiler/executor tests" — and the
   * profiler suite already uses it. Building a throwaway class here tested
   * class creation, which `integration/core/class` covers, and paid for it
   * twice a run: a class pool generated and dropped, and an `E_ABAP_GENPH`
   * lock left in SM12 on the generated parts, on E19 measured 2026-08-30.
   *
   * Shared objects are read-only by contract, so this touches nothing.
   */
  function sharedRunnableClass(testCase: any): string {
    return resolveRunnableClassName(testCase?.params ?? {});
  }

  /**
   * Re-run, and only that.
   *
   * This used to re-activate the class with a fallback source when the run
   * answered "does not implement if_oo_adt_classrun~main" — a repair for a
   * class the test had just built itself. The shared class is read-only and
   * already correct, so a retry that rewrote it would corrupt a fixture every
   * other suite depends on. If the message appears now it is a real finding,
   * and the assertions below will say so.
   */
  async function runClassWithReadinessRetry(
    className: string,
    maxAttempts: number = 3,
  ) {
    let lastResponse: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      lastResponse = await executor.getClassExecutor().run({ className });
      if (!isMissingClassRunMainMessage(lastResponse.data)) return lastResponse;
      if (attempt < maxAttempts) await wait(1000);
    }
    return lastResponse;
  }

  it(
    'should execute class via executor',
    async () => {
      const testName = 'ClassExecutor - run';
      const testCase = getEnabledTestCase(
        'execute_class',
        'adt_class_executor',
      );

      logTestStart(testsLogger, testName, {
        name: 'run',
        params: { class_name: testCase?.params?.class_name },
      });

      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          testName,
          'No .env file or SAP configuration found',
        );
        return;
      }

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'execute_class/adt_class_executor not configured or disabled in test-config.yaml',
        );
        return;
      }

      try {
        const className = sharedRunnableClass(testCase);
        logTestStep('run', testsLogger);
        const response = await runClassWithReadinessRetry(className);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        const runOutput = String(response.data);
        expectRunnableRunOutput(runOutput);
        logTestStep(`run output: ${toShortText(response.data)}`, testsLogger);

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
    'should execute class with profiling and return trace id',
    async () => {
      const testName = 'ClassExecutor - runWithProfiling';
      const testCase = getEnabledTestCase(
        'execute_class',
        'adt_class_executor',
      );

      logTestStart(testsLogger, testName, {
        name: 'run_with_profiling',
        params: { class_name: testCase?.params?.class_name },
      });

      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          testName,
          'No .env file or SAP configuration found',
        );
        return;
      }

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'execute_class/adt_class_executor not configured or disabled in test-config.yaml',
        );
        return;
      }

      const profilingEnabled = testCase?.params?.profiling?.enabled !== false;
      if (!profilingEnabled) {
        logTestSkip(testsLogger, testName, 'profiling.enabled=false');
        return;
      }

      const profilerParameters = buildProfilerParameters(
        testCase?.params?.profiling?.parameters,
      );

      try {
        const className = sharedRunnableClass(testCase);

        logTestStep('warm-up run before profiling', testsLogger);
        const warmupResponse = await runClassWithReadinessRetry(className);
        expectRunnableRunOutput(String(warmupResponse.data));

        // What exists BEFORE the run is how a new trace is recognised. The
        // feed's order is not age, so "the newest entry" is not an answer to
        // "what did my run produce".
        const profiler = runtimeClient.getProfiler();
        const before = await traceIdsNow(profiler);

        logTestStep('schedule a trace + run with profiler', testsLogger);
        let result = await executor
          .getClassExecutor()
          .runWithProfiling({ className }, { profilerParameters });
        if (isMissingClassRunMainMessage(result.response.data)) {
          await client.getClass().read({ className }, 'active', {
            withLongPolling: true,
          });
          await wait(1000);
          await runClassWithReadinessRetry(className);
          result = await executor
            .getClassExecutor()
            .runWithProfiling({ className }, { profilerParameters });
        }

        expect(result.response.status).toBe(200);
        const runOutput = String(result.response.data);
        expectRunnableRunOutput(runOutput);
        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );
        // The run promises no trace, so the result must not carry one.
        expect(result).not.toHaveProperty('traceId');

        logTestStep(
          `run output: ${toShortText(result.response.data)}`,
          testsLogger,
        );

        logTestStep('wait for the trace this run produced', testsLogger);
        const traceId = await waitForNewTrace(profiler, before, {
          logger: testsLogger,
        });
        expect(traceId).toBeDefined();
        if (!traceId) {
          throw new Error('no new trace appeared after a profiled run');
        }
        tracesCreated.push(traceId);

        logTestStep('read all three views', testsLogger);
        const hitlist = await profiler.read(traceId, 'hitlist', {
          withSystemEvents: false,
        });
        const statements = await profiler.read(traceId, 'statements', {
          withSystemEvents: false,
        });
        const dbAccesses = await profiler.read(traceId, 'dbAccesses', {
          withSystemEvents: false,
        });

        // Parsed, not a status code: a 200 carrying an unparseable body used to
        // pass here, and the whole point of the typed views is that it no
        // longer can.
        // Rows and their fields, not `Array.isArray`: an empty array was
        // what the parser used to invent from a body it could not read.
        expect(hitlist.entries.length).toBeGreaterThan(0);
        expect(typeof hitlist.entries[0]?.index).toBe('number');
        expect(statements.statements.length).toBeGreaterThan(0);
        expect(Array.isArray(dbAccesses.accesses)).toBe(true);

        logTestStep(
          `trace ${traceId}: hitlist=${hitlist.entries.length} rows, statements=${statements.statements.length}, dbAccesses=${dbAccesses.accesses.length}`,
          testsLogger,
        );

        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        if (error?.response?.status === 400) {
          const detailedError = new Error(
            'Profiling trace read failed with HTTP 400. Trace endpoints are unavailable for this user/system or request parameters are invalid.',
          );
          logTestError(testsLogger, testName, detailedError);
          throw detailedError;
        }

        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
