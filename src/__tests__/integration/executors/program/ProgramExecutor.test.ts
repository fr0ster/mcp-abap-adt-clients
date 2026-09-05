/**
 * Integration test for ProgramExecutor
 * Tests program execution with and without profiling using AdtExecutor.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  IProfiler,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import type { IProfilerTraceParameters } from '../../../../runtime/traces';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import { resolveRunnableProgramName } from '../../../helpers/runnableProgramHelper';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
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

describe('ProgramExecutor (integration)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;
  let profiler: IProfiler;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  /** Trace ids this file produced — an array for the reason above. */
  const tracesCreated: string[] = [];
  let traceUser: string | undefined;

  const connectionLogger: ILogger = createConnectionLogger();
  const libraryLogger: ILogger = createLibraryLogger();
  const testsLogger: ILogger = createTestsLogger();

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      // Only for `isLegacy` now — this suite runs a shared program and owns
      // no object, so it has nothing to ask an AdtClient for.
      const { isLegacy: legacy } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      isLegacy = legacy;
      traceUser = systemContext.responsible;
      executor = new AdtExecutor(connection, libraryLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      // No cast since 15.0.0: it reached `latestTraceId()`, which is gone, and
      // this file only ever needed what `IProfiler` already declares.
      profiler = runtime.getProfiler();
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
      isCloudSystem = false;
    }
  });

  // No object cleanup: this suite creates none now. The program it runs is a
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
    // appeared in between belongs to somebody else.
    for (const traceId of tracesCreated) {
      try {
        await runtime.getProfiler().delete(traceId);
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
   * The shared runnable program, not one built for the occasion.
   *
   * `ZAC_SHR_RUNPROG` exists for exactly this, the way `ZAC_SHR_RUN01` does for
   * the class side. Building a throwaway REPORT here tested program creation,
   * which `integration/core/program` covers, and paid for it twice a run: a
   * program generated and dropped, and an `E_ABAP_GENPH` lock left in SM12 on
   * the generated parts, on E19 measured 2026-08-30. Two suites doing that
   * against one system also race each other for those locks.
   *
   * Shared objects are read-only by contract, so this touches nothing.
   */
  function sharedRunnableProgram(testCase: any): string {
    return resolveRunnableProgramName(testCase?.params ?? {});
  }

  it(
    'should execute program via executor',
    async () => {
      const testName = 'ProgramExecutor - run';
      const testCase = getEnabledTestCase(
        'execute_program',
        'adt_program_executor',
      );

      logTestStart(testsLogger, testName, {
        name: 'run',
        params: { program_name: testCase?.params?.program_name },
      });

      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          testName,
          'No .env file or SAP configuration found',
        );
        return;
      }

      if (isCloudSystem) {
        logTestSkip(
          testsLogger,
          testName,
          'Programs are supported only on on-premise systems',
        );
        return;
      }

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'execute_program/adt_program_executor not configured or disabled in test-config.yaml',
        );
        return;
      }

      try {
        const programName = sharedRunnableProgram(testCase);
        logTestStep('run', testsLogger);
        const response = expectResult(
          await executor.getProgramExecutor().run({ programName }),
          'response',
        );

        expect(response).toBeDefined();
        const runOutput = String(response);
        expect(runOutput).toMatch(/PROGRAM_EXECUTOR_RUN_PROBE\(\s*\)\s*=\s*1/i);
        logTestStep(`run output: ${toShortText(response)}`, testsLogger);

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
    'should execute program with profiling and return trace id',
    async () => {
      const testName = 'ProgramExecutor - runWithProfiling';
      const testCase = getEnabledTestCase(
        'execute_program',
        'adt_program_executor',
      );

      logTestStart(testsLogger, testName, {
        name: 'run_with_profiling',
        params: { program_name: testCase?.params?.program_name },
      });

      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          testName,
          'No .env file or SAP configuration found',
        );
        return;
      }

      if (isCloudSystem) {
        logTestSkip(
          testsLogger,
          testName,
          'Programs are supported only on on-premise systems',
        );
        return;
      }

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'execute_program/adt_program_executor not configured or disabled in test-config.yaml',
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
        const programName = sharedRunnableProgram(testCase);

        // What the feed holds BEFORE the run, so the trace this run writes can
        // be told apart from the ones already there.
        const tracesBefore = await traceIdsNow(profiler, { user: traceUser });

        logTestStep('create trace parameters + run with profiler', testsLogger);
        const result = expectResult(
          await executor
            .getProgramExecutor()
            .runWithProfiling({ programName }, { profilerParameters }),
          'result',
        );

        expect(result.response.status).toBe(200);
        const runOutput = String(result.response);
        expect(runOutput).toMatch(/PROGRAM_EXECUTOR_RUN_PROBE\(\s*\)\s*=\s*1/i);
        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );

        logTestStep(
          `run output: ${toShortText(result.response)}; profilerId=${result.profilerId}`,
          testsLogger,
        );

        // The finished trace lives in the TRACES collection, not in the trace
        // REQUESTS one. A request is what schedules the measurement and it is
        // consumed by the run: measured on E19 straight after a profiled run,
        // `/runtime/traces/abaptraces/requests` answered 200 with an empty feed
        // of 345 bytes while `/runtime/traces/abaptraces` held 95KB of entries
        // owned by this very user — the profiling had worked all along and the
        // test was reading the wrong feed.
        // Poll for a trace that was NOT there before this run, rather than
        // trusting "the newest one". SAP writes traces asynchronously, so the
        // trace may not exist the instant the run returns — and a test that
        // takes whatever the feed offers passes on someone else's trace. This
        // one did: four consecutive runs resolved the SAME id while each was
        // creating a new trace of its own. Measured on E19, the difference
        // shows up on the first or second attempt.
        logTestStep('poll for the trace this run produced', testsLogger);
        const traceId = await waitForNewTrace(profiler, tracesBefore, {
          user: traceUser,
          attempts: 5,
          delayMs: 2000,
          logger: testsLogger,
        });
        expect(traceId).toBeDefined();
        if (!traceId) {
          throw new Error('no new trace appeared after a profiled run');
        }
        tracesCreated.push(traceId);

        logTestStep(`traceId=${traceId}`, testsLogger);

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

        // Parsed rows, not a status code: a 200 with a body nothing could read
        // used to satisfy this.
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
