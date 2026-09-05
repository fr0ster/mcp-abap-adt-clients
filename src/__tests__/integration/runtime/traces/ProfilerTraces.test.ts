/**
 * Integration test for Profiler Traces
 * Tests profiler trace APIs using AdtRuntimeClient:
 * - List trace files, requests, object types, process types
 * - Create trace parameters (POST only — GET returns 405)
 * - Run a pre-existing shared class with profiling
 * - Discover traces from trace files feed
 * - Read individual trace (hitlist, statements, dbAccesses)
 * - Delete the trace this run produced
 *
 * The runnable class (e.g. ZAC_SHR_RUN01) must already exist on the SAP system.
 * The test does NOT create or modify the class.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/traces/ProfilerTraces.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import type { Profiler } from '../../../../runtime/traces/ProfilerDomain';
import { compareRecordedAt } from '../../../../runtime/traces/traceParsing';
import { expectResult } from '../../../helpers/contract';
import { resolveRunnableClassName } from '../../../helpers/runnableClassHelper';
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
import { traceIdsNow, waitForNewTrace } from '../../../helpers/traceHelpers';

const {
  getEnabledTestCase,
  getTimeout,
  isHttpStatusAllowed,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

function extractTraceId(payload: unknown): string | undefined {
  const text =
    typeof payload === 'string'
      ? payload
      : payload == null
        ? ''
        : JSON.stringify(payload);
  const match = text.match(
    /\/sap\/bc\/adt\/runtime\/traces\/abaptraces\/([A-Za-z0-9]{16,})(?=\/|[?&#"'\s]|$)/,
  );
  return match?.[1];
}

describe('Profiler Traces (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  // Shared state between tests — traceId from profiled run or discovery
  let resolvedTraceId: string | undefined;
  /**
   * Only the trace THIS run produced, and never a discovered one.
   *
   * `resolvedTraceId` may come from the feed, and on a shared system the newest
   * trace in the feed belongs to whoever profiled last — deleting that would
   * take somebody else's measurement away mid-analysis. So deletion is scoped
   * to what this file made.
   */
  let traceIdFromThisRun: string | undefined;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      executor = new AdtExecutor(connection, libraryLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    // The delete test clears this on success, so this only fires when the test
    // failed before removing the trace it made — otherwise a red run leaves the
    // very thing this suite exists to clean up.
    if (traceIdFromThisRun && runtime) {
      try {
        await runtime.getProfiler().delete(traceIdFromThisRun);
      } catch (cleanupError) {
        testsLogger.warn?.(
          `⚠️ Cleanup failed for trace ${traceIdFromThisRun}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }

    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it(
    'should list trace files, requests, object types and process types',
    async () => {
      const testName = 'Profiler Traces - list endpoints';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        logTestStep('list profiler traces', testsLogger);
        const traces = expectResult(
          await runtime.getProfiler().list(),
          'traces',
        );
        expect(Array.isArray(traces)).toBe(true);
        // Every entry the contract promises: an id and when it was recorded.
        // A parsed listing that silently yields shapeless objects is the defect
        // typing it was meant to remove, so this asserts the fields exist.
        for (const trace of traces) {
          expect(typeof trace.id).toBe('string');
          expect(trace.id.length).toBeGreaterThan(0);
          expect(typeof trace.recordedAt).toBe('string');
        }

        // Scheduling lives on the executors now, not the profiler.
        const classExecutor = executor.getClassExecutor();

        logTestStep('list trace requests (the schedule)', testsLogger);
        const requests = expectResult(
          await classExecutor.listRequests(),
          'trace requests',
        );
        // Empty means nothing is scheduled — the runs consume them — NOT that
        // the endpoint is dead. So this asserts a list, not a length.
        expect(Array.isArray(requests)).toBe(true);

        logTestStep('list profiler object types', testsLogger);
        const objectTypes = expectResult(
          await classExecutor.listObjectTypes(),
          'objectTypes',
        );
        expect(objectTypes.length).toBeGreaterThan(0);
        // Measured: the name is a URI, not a short code, and it is the same
        // string a stored request echoes back as its objectTypeId.
        expect(objectTypes[0]?.name).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/objecttypes/',
        );
        expect(typeof objectTypes[0]?.description).toBe('string');

        logTestStep('list profiler process types', testsLogger);
        const processTypes = expectResult(
          await classExecutor.listProcessTypes(),
          'processTypes',
        );
        expect(processTypes.length).toBeGreaterThan(0);
        expect(processTypes[0]?.name).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/processtypes/',
        );

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should create trace parameters',
    async () => {
      const testName = 'Profiler Traces - create parameters';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const params = testCase?.params || {};
      if (params.skip_create === true) {
        logTestSkip(
          testsLogger,
          testName,
          'skip_create=true in test-config.yaml',
        );
        return;
      }

      try {
        // Note: GET /parameters returns 405 — only POST is supported
        logTestStep(
          'create profiler trace parameters with defaults (POST)',
          testsLogger,
        );
        // Scheduling moved to the executors, and it answers with the request
        // id rather than a response: reading the created resource back gives
        // `200` with an EMPTY body, measured, so the id is only ever in the
        // Location header.
        const requestId = expectResult(
          await executor.getClassExecutor().scheduleTrace({
            description: 'adt-clients integration test',
          }),
          'schedule a trace',
        );

        logTestStep(`trace request id: ${requestId}`, testsLogger);
        expect(requestId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should run shared class with profiling',
    async () => {
      const testName = 'Profiler Traces - run with profiling';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const params = testCase?.params || {};
      if (params.skip_run_with_profiling === true) {
        logTestSkip(
          testsLogger,
          testName,
          'skip_run_with_profiling=true in test-config.yaml',
        );
        return;
      }

      try {
        const className = resolveRunnableClassName(params);

        // What the feed holds before the run, so the trace this run writes can
        // be told from the ones already there.
        const tracesBeforeRun = await traceIdsNow(runtime.getProfiler());

        logTestStep(
          `run shared class ${className} with profiling`,
          testsLogger,
        );
        const result = expectResult(
          await executor.getClassExecutor().runWithProfiling({ className }),
          'result',
        );

        // The run's own answer, read by the shipped strategy. There is no
        // status to check here any more — a run that failed would have come
        // back as the failure half and `expectResult` would have said so.
        expect(result.run).toBeDefined();
        logTestStep(
          `run output: ${String(result.run).replace(/\s+/g, ' ').trim().slice(0, 140)}`,
          testsLogger,
        );

        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );
        // A run promises no trace — SAP writes it afterwards.
        expect(result).not.toHaveProperty('traceId');

        logTestStep(
          `profilerId=${result.profilerId}; waiting for the trace`,
          testsLogger,
        );

        // So the caller waits for one that was not there before. This is the
        // test's job now, not the library's: only the caller knows how long it
        // is willing to wait.
        resolvedTraceId = await waitForNewTrace(
          runtime.getProfiler(),
          tracesBeforeRun,
          { logger: testsLogger },
        );
        expect(resolvedTraceId).toBeDefined();
        traceIdFromThisRun = resolvedTraceId;

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should discover traces from trace files feed',
    async () => {
      const testName = 'Profiler Traces - discover traces';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        const params = testCase?.params || {};
        const configuredTraceId =
          typeof params.trace_id === 'string' && params.trace_id.trim()
            ? params.trace_id.trim()
            : undefined;

        if (configuredTraceId) {
          logTestStep(
            `using configured trace id: ${configuredTraceId}`,
            testsLogger,
          );
          resolvedTraceId = configuredTraceId;
        } else if (!resolvedTraceId) {
          logTestStep('discover trace id from the trace feed', testsLogger);
          const traces = expectResult(
            await runtime.getProfiler().list(),
            'traces',
          );
          expect(Array.isArray(traces)).toBe(true);

          // Newest by timestamp. Position in the feed is NOT age — measured,
          // the first entries were minutes old and the last eight days older.
          const discoveredId =
            traces.length > 0
              ? traces.reduce((latest, entry) =>
                  compareRecordedAt(entry, latest) > 0 ? entry : latest,
                ).id
              : undefined;
          if (discoveredId) {
            logTestStep(
              `discovered trace id: ${discoveredId} (source=trace_files_feed)`,
              testsLogger,
            );
            resolvedTraceId = discoveredId;
          } else {
            logTestStep('no trace id configured or discovered', testsLogger);
          }
        } else {
          logTestStep(
            `using trace id from profiled run: ${resolvedTraceId}`,
            testsLogger,
          );
        }

        expect(resolvedTraceId).toBeDefined();
        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should read trace details (hitlist, statements, db accesses)',
    async () => {
      const testName = 'Profiler Traces - read trace details';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      if (!resolvedTraceId) {
        logTestSkip(
          testsLogger,
          testName,
          'no trace id available (previous tests did not resolve one)',
        );
        return;
      }

      try {
        const traceId = resolvedTraceId;
        logTestStep(`read trace hitlist for ${traceId}`, testsLogger);
        // `Array.isArray` alone is not an assertion here: it was true of the
        // fallback empty result the parser used to invent from an unreadable
        // body. A real trace has rows, and a row has the fields the contract
        // names — that is what proves the document was understood.
        const hitlist = expectResult(
          await runtime
            .getProfiler()
            .read(traceId, 'hitlist', { withSystemEvents: false }),
          'hitlist',
        );
        expect(hitlist.entries.length).toBeGreaterThan(0);
        expect(typeof hitlist.entries[0]?.index).toBe('number');

        logTestStep(
          `read trace hitlist with system events for ${traceId}`,
          testsLogger,
        );
        const hitlistWithEvents = expectResult(
          await runtime
            .getProfiler()
            .read(traceId, 'hitlist', { withSystemEvents: true }),
          'hitlistWithEvents',
        );
        expect(Array.isArray(hitlistWithEvents.entries)).toBe(true);

        logTestStep(`read trace statements for ${traceId}`, testsLogger);
        const statements = expectResult(
          await runtime
            .getProfiler()
            .read(traceId, 'statements', { withSystemEvents: false }),
          'statements',
        );
        expect(statements.statements.length).toBeGreaterThan(0);
        expect(typeof statements.statements[0]?.id).toBe('string');

        logTestStep(`read trace db accesses for ${traceId}`, testsLogger);
        const dbAccesses = expectResult(
          await runtime
            .getProfiler()
            .read(traceId, 'dbAccesses', { withSystemEvents: false }),
          'dbAccesses',
        );
        expect(Array.isArray(dbAccesses.accesses)).toBe(true);

        logTestStep(
          `trace details: hitlist=${hitlist.entries.length} rows (${hitlistWithEvents.entries.length} with system events), statements=${statements.statements.length}, dbAccesses=${dbAccesses.accesses.length}`,
          testsLogger,
        );

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should get trace requests filtered by URI',
    async () => {
      const testName = 'Profiler Traces - requests by URI';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      const params = testCase?.params || {};
      // Falls back to the class this suite already runs, rather than skipping.
      //
      // `object_uri` ships empty in the template, so this test skipped on every
      // system it was ever run on — both transports, every time — and
      // `getRequestsByUri` had no coverage against SAP at all. A skip whose
      // reason is an unfilled config value is not the same as one whose reason
      // is the environment, and only the second kind is normal.
      const objectUri =
        typeof params.object_uri === 'string' && params.object_uri.trim()
          ? params.object_uri.trim()
          : `/sap/bc/adt/oo/classes/${resolveRunnableClassName(params).toLowerCase()}`;

      try {
        logTestStep(`get trace requests by URI: ${objectUri}`, testsLogger);
        const requests = await executor
          .getClassExecutor()
          .getRequestsByUri(objectUri);
        // A list, possibly empty: nothing scheduled for that URI is a normal
        // answer, not a failure.
        expect(Array.isArray(requests)).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should delete the trace this run produced',
    async () => {
      const testName = 'Profiler Traces - delete trace';
      const testCase = getEnabledTestCase(
        'profiler_traces',
        'adt_profiler_traces',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_profiler_traces',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'profiler_traces/adt_profiler_traces not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      if (!traceIdFromThisRun) {
        // Deliberately NOT falling back to `resolvedTraceId`: that one can come
        // from the feed, and deleting a trace this file did not make is not
        // this test's business.
        logTestSkip(
          testsLogger,
          testName,
          'the profiled run produced no trace to delete',
        );
        return;
      }

      try {
        const traceId = traceIdFromThisRun;
        logTestStep(`delete trace ${traceId}`, testsLogger);
        await runtime.getProfiler().delete(traceId);

        // Deleted means gone from the feed. Polled rather than read once,
        // because how quickly the feed reflects a deletion is not measured —
        // but the id must disappear, or the call did nothing.
        //
        // These lines are the ones the log tends not to show, and their absence
        // does NOT mean the loop was skipped: a passing test proves it ran, or
        // `stillListed` would still be `true`. This suite writes progress
        // straight to stdout from a jest worker, and that output reaches the
        // parent through an asynchronous relay which `forceExit: true` does not
        // wait for. Measured on an on-prem run: over RFC the line survived but
        // landed *after* jest's own summary, and over HTTP it did not arrive at
        // all. See decision 5 in `docs/architecture/DECISIONS.md`.
        let stillListed = true;
        for (let attempt = 1; attempt <= 4 && stillListed; attempt++) {
          const ids = await traceIdsNow(runtime.getProfiler());
          stillListed = ids.has(traceId);
          logTestStep(
            `after delete, attempt ${attempt}: trace ${stillListed ? 'still listed' : 'gone from the feed'}`,
            testsLogger,
          );
          if (stillListed && attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        expect(stillListed).toBe(false);

        // Nothing left for a later run to trip over.
        traceIdFromThisRun = undefined;
        if (resolvedTraceId === traceId) {
          resolvedTraceId = undefined;
        }

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
