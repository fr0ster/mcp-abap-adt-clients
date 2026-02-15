/**
 * Integration test for ClassExecutor
 * Tests class execution with and without profiling using AdtExecutor.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import {
  getTraceDbAccesses,
  getTraceHitList,
  getTraceStatements,
  type IProfilerTraceParameters,
} from '../../../../runtime/traces';
import { getConfig } from '../../../helpers/sessionConfig';
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

function generateClassName(baseName: string): string {
  const base = (baseName || 'ZADT_BLD_CLS_EXE')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
  const suffix = Date.now().toString().slice(-4);
  const maxBaseLen = 30 - suffix.length;
  return `${base.slice(0, maxBaseLen)}${suffix}`;
}

function resolveRunnableClassSource(testCase: any, className: string): string {
  const sourceTemplate = testCase?.params?.source_code;
  if (!sourceTemplate || typeof sourceTemplate !== 'string') {
    throw new Error(
      'source_code is not configured in execute_class params (test-config.yaml)',
    );
  }

  return sourceTemplate.replaceAll('{{CLASS_NAME}}', className);
}

describe('ClassExecutor (integration)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let executor: AdtExecutor;
  let hasConfig = false;
  let classNameForTest: string | null = null;
  let transportRequestForCleanup = '';

  const connectionLogger: ILogger = createConnectionLogger();
  const libraryLogger: ILogger = createLibraryLogger();
  const testsLogger: ILogger = createTestsLogger();

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      executor = new AdtExecutor(connection, libraryLogger);
      hasConfig = true;
      classNameForTest = null;
      transportRequestForCleanup = '';
    } catch (_error) {
      testsLogger.warn(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection && classNameForTest) {
      try {
        await client.getClass().delete({
          className: classNameForTest,
          transportRequest: transportRequestForCleanup,
        });
      } catch (cleanupError) {
        testsLogger.warn?.(
          `⚠️ Cleanup failed for class ${classNameForTest}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }

    if (connection) {
      (connection as any).reset();
    }
  });

  async function ensureRunnableClass(testCase: any): Promise<string> {
    const baseClassName = testCase?.params?.class_name || 'ZADT_BLD_CLS_EXE';
    const packageName = resolvePackageName(testCase?.params?.package_name);
    const transportRequest = resolveTransportRequest(
      testCase?.params?.transport_request,
    );

    if (!packageName) {
      throw new Error(
        'package_name is not configured (set params.package_name or environment.default_package)',
      );
    }

    const className = generateClassName(baseClassName);
    const sourceCode = resolveRunnableClassSource(testCase, className);

    classNameForTest = className;
    transportRequestForCleanup = transportRequest || '';

    logTestStep(`create class ${className}`, testsLogger);
    await client.getClass().create({
      className,
      packageName,
      transportRequest,
      description: `ClassExecutor integration ${className}`,
    });

    logTestStep('update class source', testsLogger);
    await client.getClass().update(
      {
        className,
        sourceCode,
        transportRequest,
      },
      {
        activateOnUpdate: true,
        sourceCode,
      },
    );

    return className;
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
        const className = await ensureRunnableClass(testCase);
        logTestStep('run', testsLogger);
        const response = await executor.getClassExecutor().run({ className });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        const runOutput = String(response.data);
        expect(runOutput).not.toMatch(
          /does not implement if_oo_adt_classrun~main method/i,
        );
        expect(runOutput).toMatch(/run_probe\(\)/i);
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
        const className = await ensureRunnableClass(testCase);

        logTestStep('create trace parameters + run with profiler', testsLogger);
        const result = await executor
          .getClassExecutor()
          .runWithProfiling({ className }, { profilerParameters });

        expect(result.response.status).toBe(200);
        const runOutput = String(result.response.data);
        expect(runOutput).not.toMatch(
          /does not implement if_oo_adt_classrun~main method/i,
        );
        expect(runOutput).toMatch(/run_probe\(\)/i);
        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );
        expect(typeof result.traceId).toBe('string');
        expect(result.traceId.length).toBeGreaterThan(10);
        expect(result.traceRequestsResponse.status).toBe(200);

        logTestStep(
          `run output: ${toShortText(result.response.data)}; traceId=${result.traceId}`,
          testsLogger,
        );

        logTestStep('read trace hitlist', testsLogger);
        const hitlist = await getTraceHitList(connection, result.traceId, {
          withSystemEvents: false,
        });
        expect(hitlist.status).toBe(200);

        logTestStep('read trace statements', testsLogger);
        const statements = await getTraceStatements(
          connection,
          result.traceId,
          {
            withSystemEvents: false,
          },
        );
        expect(statements.status).toBe(200);

        logTestStep('read trace db accesses', testsLogger);
        const dbAccesses = await getTraceDbAccesses(
          connection,
          result.traceId,
          {
            withSystemEvents: false,
          },
        );
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
