/**
 * Integration test for Profiler Traces
 * Tests profiler trace APIs using AdtRuntimeClient:
 * - List trace files, requests, object types, process types
 * - Create trace parameters (POST only — GET returns 405)
 * - Run a pre-existing shared class with profiling
 * - Discover traces from trace files feed
 * - Read individual trace (hitlist, statements, dbAccesses)
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
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import { resolveRunnableClassName } from '../../../helpers/runnableClassHelper';
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
  let connection: IAbapConnection;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  // Shared state between tests — traceId from profiled run or discovery
  let resolvedTraceId: string | undefined;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      executor = new AdtExecutor(connection, libraryLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      await (connection as any).reset();
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
        logTestStep('list profiler trace files', testsLogger);
        const traceFilesResponse = await runtime.listProfilerTraceFiles();
        expect(traceFilesResponse.status).toBeGreaterThanOrEqual(200);
        expect(traceFilesResponse.status).toBeLessThan(300);
        expect(traceFilesResponse.data).toBeDefined();

        logTestStep('list profiler trace requests', testsLogger);
        const traceRequestsResponse = await runtime.listProfilerTraceRequests();
        expect(traceRequestsResponse.status).toBeGreaterThanOrEqual(200);
        expect(traceRequestsResponse.status).toBeLessThan(300);
        expect(traceRequestsResponse.data).toBeDefined();

        logTestStep('list profiler object types', testsLogger);
        const objectTypesResponse = await runtime.listProfilerObjectTypes();
        expect(objectTypesResponse.status).toBeGreaterThanOrEqual(200);
        expect(objectTypesResponse.status).toBeLessThan(300);
        expect(objectTypesResponse.data).toBeDefined();

        logTestStep('list profiler process types', testsLogger);
        const processTypesResponse = await runtime.listProfilerProcessTypes();
        expect(processTypesResponse.status).toBeGreaterThanOrEqual(200);
        expect(processTypesResponse.status).toBeLessThan(300);
        expect(processTypesResponse.data).toBeDefined();

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
        const createResponse = await runtime.createProfilerTraceParameters({
          description: 'adt-clients integration test',
        });
        expect(createResponse.status).toBeGreaterThanOrEqual(200);
        expect(createResponse.status).toBeLessThan(300);

        const profilerId =
          runtime.extractProfilerIdFromResponse(createResponse);
        logTestStep(
          `profiler id from response: ${profilerId || '(none)'}`,
          testsLogger,
        );

        if (profilerId) {
          expect(profilerId).toContain(
            '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
          );
        }

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

        logTestStep(
          `run shared class ${className} with profiling`,
          testsLogger,
        );
        const result = await executor
          .getClassExecutor()
          .runWithProfiling({ className });

        expect(result.response.status).toBe(200);
        expect(result.response.data).toBeDefined();
        logTestStep(
          `run output: ${String(result.response.data).replace(/\s+/g, ' ').trim().slice(0, 140)}`,
          testsLogger,
        );

        expect(result.profilerId).toContain(
          '/sap/bc/adt/runtime/traces/abaptraces/parameters/',
        );
        expect(typeof result.traceId).toBe('string');
        expect(result.traceId.length).toBeGreaterThan(10);

        logTestStep(
          `traceId=${result.traceId}, profilerId=${result.profilerId}`,
          testsLogger,
        );

        // Save traceId for subsequent tests
        resolvedTraceId = result.traceId;

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
          logTestStep('discover trace id from trace files feed', testsLogger);
          const traceFilesResponse = await runtime.listProfilerTraceFiles();
          expect(traceFilesResponse.status).toBeGreaterThanOrEqual(200);
          expect(traceFilesResponse.status).toBeLessThan(300);

          const discoveredId = extractTraceId(traceFilesResponse.data);
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
        const hitlistResponse = await runtime.getProfilerTraceHitList(traceId, {
          withSystemEvents: false,
        });
        expect(hitlistResponse.status).toBeGreaterThanOrEqual(200);
        expect(hitlistResponse.status).toBeLessThan(300);
        expect(hitlistResponse.data).toBeDefined();

        logTestStep(
          `read trace hitlist with system events for ${traceId}`,
          testsLogger,
        );
        const hitlistWithEventsResponse = await runtime.getProfilerTraceHitList(
          traceId,
          {
            withSystemEvents: true,
          },
        );
        expect(hitlistWithEventsResponse.status).toBeGreaterThanOrEqual(200);
        expect(hitlistWithEventsResponse.status).toBeLessThan(300);

        logTestStep(`read trace statements for ${traceId}`, testsLogger);
        const statementsResponse = await runtime.getProfilerTraceStatements(
          traceId,
          { withSystemEvents: false },
        );
        expect(statementsResponse.status).toBeGreaterThanOrEqual(200);
        expect(statementsResponse.status).toBeLessThan(300);
        expect(statementsResponse.data).toBeDefined();

        logTestStep(`read trace db accesses for ${traceId}`, testsLogger);
        const dbAccessesResponse = await runtime.getProfilerTraceDbAccesses(
          traceId,
          { withSystemEvents: false },
        );
        expect(dbAccessesResponse.status).toBeGreaterThanOrEqual(200);
        expect(dbAccessesResponse.status).toBeLessThan(300);
        expect(dbAccessesResponse.data).toBeDefined();

        logTestStep(
          `trace details: hitlist=${hitlistResponse.status}, statements=${statementsResponse.status}, dbAccesses=${dbAccessesResponse.status}`,
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
      const objectUri =
        typeof params.object_uri === 'string' && params.object_uri.trim()
          ? params.object_uri.trim()
          : undefined;

      if (!objectUri) {
        logTestSkip(
          testsLogger,
          testName,
          'object_uri not configured in test-config.yaml params',
        );
        return;
      }

      try {
        logTestStep(`get trace requests by URI: ${objectUri}`, testsLogger);
        const response = await runtime.getProfilerTraceRequestsByUri(objectUri);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        expect(response.data).toBeDefined();

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
});
