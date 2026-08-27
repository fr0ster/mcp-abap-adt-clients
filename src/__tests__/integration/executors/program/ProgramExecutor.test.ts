/**
 * Integration test for ProgramExecutor
 * Tests program execution with and without profiling using AdtExecutor.
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
import type { Profiler } from '../../../../runtime/traces/ProfilerDomain';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
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

const {
  getEnabledTestCase,
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
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

function generateProgramName(baseName: string): string {
  const base = (baseName || 'ZADT_BLD_PROG_EXE')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
  const suffix = Date.now().toString().slice(-4);
  const maxBaseLen = 30 - suffix.length;
  return `${base.slice(0, maxBaseLen)}${suffix}`;
}

function resolveRunnableProgramSource(
  testCase: any,
  programName: string,
): string {
  const sourceTemplate = testCase?.params?.source_code;
  if (sourceTemplate && typeof sourceTemplate === 'string') {
    return sourceTemplate.replaceAll('{{PROGRAM_NAME}}', programName);
  }

  return [
    `REPORT ${programName}.`,
    "WRITE: / 'PROGRAM_EXECUTOR_RUN_PROBE( ) = 1'.",
    '',
  ].join('\n');
}

describe('ProgramExecutor (integration)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;
  let profiler: Profiler;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let programNameForTest: string | null = null;
  // EVERY program this file creates, not just the last. Each test generates a
  // fresh name and overwrote the single variable, so afterAll deleted the newest
  // and left the earlier one on the system — once per run. Seen on E19 in SM12
  // as E_ABAP_GENPH locks accumulating under names nobody would ever revisit.
  const programsCreated: string[] = [];
  let traceUser: string | undefined;
  let transportRequestForCleanup = '';

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
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      traceUser = systemContext.responsible;
      executor = new AdtExecutor(connection, libraryLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      // `getProfiler()` is typed `IProfiler`, and that contract — which lives in
      // @mcp-abap-adt/interfaces — does not carry `latestTraceId()` yet. The
      // implementation is this package's and the class is exported, so the cast
      // is the seam between the two. It goes when the contract catches up.
      profiler = runtime.getProfiler() as Profiler;
      hasConfig = true;
      programNameForTest = null;
      programsCreated.length = 0;
      transportRequestForCleanup = '';
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
      isCloudSystem = false;
    }
  });

  afterAll(async () => {
    for (const programName of programsCreated) {
      try {
        await client.getProgram().delete({
          programName,
          transportRequest: transportRequestForCleanup,
        });
      } catch (cleanupError) {
        testsLogger.warn?.(
          `⚠️ Cleanup failed for program ${programName}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }

    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  async function ensureRunnableProgram(testCase: any): Promise<string> {
    const baseProgramName =
      testCase?.params?.program_name || 'ZADT_BLD_PROG_EXE';
    const packageName = resolvePackageName(testCase?.params?.package_name);
    const transportRequest = resolveTransportRequest(
      testCase?.params?.transport_request,
    );

    if (!packageName) {
      throw new Error(
        'package_name is not configured (set params.package_name or environment.default_package)',
      );
    }

    const programName = generateProgramName(baseProgramName);
    const sourceCode = resolveRunnableProgramSource(testCase, programName);

    programNameForTest = programName;
    programsCreated.push(programNameForTest);
    transportRequestForCleanup = transportRequest || '';

    logTestStep(`create program ${programName}`, testsLogger);
    await client.getProgram().create({
      programName,
      packageName,
      transportRequest,
      description: `ProgramExecutor integration ${programName}`,
    });

    logTestStep('update program source', testsLogger);
    await client.getProgram().update(
      {
        programName,
        sourceCode,
        transportRequest,
      },
      {
        activateOnUpdate: true,
        sourceCode,
      },
    );

    return programName;
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
        const programName = await ensureRunnableProgram(testCase);
        logTestStep('run', testsLogger);
        const response = await executor
          .getProgramExecutor()
          .run({ programName });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        const runOutput = String(response.data);
        expect(runOutput).toMatch(/PROGRAM_EXECUTOR_RUN_PROBE\(\s*\)\s*=\s*1/i);
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
        const programName = await ensureRunnableProgram(testCase);

        // What the feed holds BEFORE the run, so the trace this run writes can
        // be told apart from the ones already there.
        const tracesBefore = new Set(
          (await profiler.listTraceIds({ user: traceUser })).map((t) => t.id),
        );

        logTestStep('create trace parameters + run with profiler', testsLogger);
        const result = await executor
          .getProgramExecutor()
          .runWithProfiling({ programName }, { profilerParameters });

        expect(result.response.status).toBe(200);
        const runOutput = String(result.response.data);
        expect(runOutput).toMatch(/PROGRAM_EXECUTOR_RUN_PROBE\(\s*\)\s*=\s*1/i);
        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );

        logTestStep(
          `run output: ${toShortText(result.response.data)}; profilerId=${result.profilerId}`,
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
        let traceId: string | undefined;
        for (let attempt = 1; attempt <= 5 && !traceId; attempt++) {
          const seenNow = await profiler.listTraceIds({ user: traceUser });
          traceId = seenNow.find((t) => !tracesBefore.has(t.id))?.id;
          if (!traceId && attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        expect(traceId).toBeDefined();
        expect(typeof traceId).toBe('string');
        expect((traceId as string).length).toBeGreaterThan(10);

        logTestStep(`traceId=${traceId}`, testsLogger);

        logTestStep('read trace hitlist', testsLogger);
        const hitlist = await profiler.getHitList(traceId as string, {
          withSystemEvents: false,
        });
        expect(hitlist.status).toBe(200);

        logTestStep('read trace statements', testsLogger);
        const statements = await profiler.getStatements(traceId as string, {
          withSystemEvents: false,
        });
        expect(statements.status).toBe(200);

        logTestStep('read trace db accesses', testsLogger);
        const dbAccesses = await profiler.getDbAccesses(traceId as string, {
          withSystemEvents: false,
        });
        expect(dbAccesses.status).toBe(200);

        logTestStep(
          `trace summary: hitlist=${hitlist.status}, statements=${statements.status}, dbAccesses=${dbAccesses.status}`,
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
