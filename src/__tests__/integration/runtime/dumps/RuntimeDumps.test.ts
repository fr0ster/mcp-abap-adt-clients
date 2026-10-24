/**
 * Integration test for Runtime Dumps
 * Tests runtime dump read APIs using AdtRuntimeClient.
 *
 * The dump class (e.g. ZADT_BLD_DMP01) must already exist on the SAP system.
 * The test does NOT create or modify the class — it only runs it to produce a dump.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/dumps/RuntimeDumps.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import { resolveDumpClassName } from '../../../helpers/dumpClassHelper';
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

function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.trunc(num);
}

function extractDumpId(payload: unknown): string | undefined {
  const text =
    typeof payload === 'string'
      ? payload
      : payload == null
        ? ''
        : JSON.stringify(payload);
  const match = text.match(
    /\/sap\/bc\/adt\/runtime\/dump(?:s)?\/([^"'?&<\s]+)/,
  );
  return match?.[1];
}

function extractDumpIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const text =
    typeof payload === 'string'
      ? payload
      : payload == null
        ? ''
        : JSON.stringify(payload);
  const regex = /\/sap\/bc\/adt\/runtime\/dump(?:s)?\/([^"'?&<\s]+)/g;
  let match = regex.exec(text);
  while (match) {
    ids.add(match[1]);
    match = regex.exec(text);
  }
  return [...ids];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Runtime Dumps (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      executor = new AdtExecutor(connection, libraryLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate('runtime_dumps', 'adt_runtime_dumps')(
    'should read dumps feed and optionally dump payload by ID',
    async () => {
      const testName = 'Runtime Dumps - read';
      const testCase = configuredCase('runtime_dumps', 'adt_runtime_dumps');

      logTestStart(testsLogger, testName, {
        name: 'adt_runtime_dumps',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(
          missingCaseMessage('runtime_dumps', 'adt_runtime_dumps'),
        );
      }

      try {
        const params = testCase?.params || {};
        const top = toPositiveInt(params.top, 20);
        const user =
          typeof params.user === 'string' && params.user.trim()
            ? params.user.trim()
            : undefined;
        const inlinecount =
          params.inlinecount === 'allpages' ? 'allpages' : undefined;
        const generateArtificialDump =
          params.generate_artificial_dump !== false;
        const maxAttempts = toPositiveInt(params.retries, 8);
        const retryDelayMs = toPositiveInt(params.retry_delay_ms, 1500);

        const beforeDumpIds = new Set<string>();

        logTestStep('list runtime dumps', testsLogger);
        const listResponse = expectResult(
          await runtime
            .getDumps()
            .list({ analyse: analyseException, top, inlinecount }),
          'listResponse',
        );
        expect(listResponse).toBeDefined();

        logTestStep('list runtime dumps with from/to filter', testsLogger);
        const now = new Date();
        const toDate = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const fromDate = oneDayAgo
          .toISOString()
          .replace(/[-:T]/g, '')
          .slice(0, 14);
        const filteredResponse = expectResult(
          await runtime.getDumps().list({
            analyse: analyseException,
            from: fromDate,
            to: toDate,
            top,
            inlinecount,
          }),
          'filteredResponse',
        );
        expect(filteredResponse).toBeDefined();

        logTestStep('list runtime dumps by user', testsLogger);
        const byUserResponse = expectResult(
          await runtime
            .getDumps()
            .listByUser(user, { analyse: analyseException, top, inlinecount }),
          'byUserResponse',
        );

        logTestStep(
          'list runtime dumps by user with from/to filter',
          testsLogger,
        );
        const byUserFilteredResponse = expectResult(
          await runtime.getDumps().listByUser(user, {
            analyse: analyseException,
            top,
            inlinecount,
            from: fromDate,
            to: toDate,
          }),
          'byUserFilteredResponse',
        );
        // What is on the system before the run, asked the way discovery asks
        // afterwards: a dump that merely falls into the wider window later is
        // not this run's.
        const discoveryQuery = { top: Math.max(top, 50), inlinecount } as const;
        if (generateArtificialDump) {
          const before = expectResult(
            await runtime.getDumps().listByUser(user, {
              analyse: analyseException,
              ...discoveryQuery,
            }),
            'dumps before the run',
          );
          for (const id of extractDumpIds(before)) {
            beforeDumpIds.add(id);
          }
        }

        let generatedDumpId: string | undefined;
        if (generateArtificialDump) {
          const className = resolveDumpClassName(params);
          logTestStep(
            `run shared dump class ${className} (division by zero)`,
            testsLogger,
          );
          // The run is *meant* to fail, with a division by zero, and SAP writes
          // a dump because of it. Only that failure is accepted: a refusal
          // (401/403), a missing class (404), a bad request or a failure that
          // never reached the system produces no dump and fails the test here.
          const run = await executor
            .getClassExecutor()
            .run({ className }, { analyse: analyseException });
          if (!run.ok) {
            const failure = run.getError();
            const status = failure.response?.status;
            if (status !== 500) {
              throw new Error(
                `running ${className} failed [${failure.origin}] with ${status ?? 'no HTTP status'}, not the runtime error that writes a dump: ${failure.message}`,
              );
            }
          }

          // A dump counts only if it is new since before the run and it is the
          // dump of the class that was run.
          const checked = new Set<string>();
          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            logTestStep(
              `discover generated dump attempt ${attempt}/${maxAttempts}`,
              testsLogger,
            );
            const current = expectResult(
              await runtime.getDumps().listByUser(user, {
                analyse: analyseException,
                ...discoveryQuery,
              }),
              'current',
            );
            for (const id of extractDumpIds(current)) {
              if (beforeDumpIds.has(id) || checked.has(id)) continue;
              checked.add(id);
              const summary = expectResult(
                await runtime
                  .getDumps()
                  .getById(id, { analyse: analyseException, view: 'summary' }),
                `summary of new dump ${id}`,
              );
              const text =
                typeof summary === 'string' ? summary : JSON.stringify(summary);
              if (text.toUpperCase().includes(className.toUpperCase())) {
                generatedDumpId = id;
                break;
              }
            }
            if (generatedDumpId) {
              break;
            }
            if (attempt < maxAttempts) {
              await delay(retryDelayMs);
            }
          }
          if (!generatedDumpId) {
            throw new Error(
              `no new runtime dump of ${className} appeared after ${maxAttempts} attempts: the run wrote none`,
            );
          }
          logTestStep(`generated dump found: ${generatedDumpId}`, testsLogger);
        }

        const configuredDumpId =
          typeof params.dump_id === 'string' && params.dump_id.trim()
            ? params.dump_id.trim()
            : undefined;
        const discoveredDumpId = extractDumpId(listResponse);
        // With generation on, only the dump this run wrote is read; an older
        // one never stands in for it.
        const dumpId = generateArtificialDump
          ? generatedDumpId
          : configuredDumpId || discoveredDumpId;
        const dumpIdSource = generateArtificialDump
          ? 'forced_class_failure'
          : configuredDumpId
            ? 'config.dump_id'
            : discoveredDumpId
              ? 'initial_feed'
              : 'none';

        if (dumpId) {
          logTestStep(
            `selected dump id: ${dumpId} (source=${dumpIdSource})`,
            testsLogger,
          );

          logTestStep(
            `read via getRuntimeDumpById (endpoint=/sap/bc/adt/runtime/dump/{id})`,
            testsLogger,
          );
          logTestStep(`read runtime dump by id: ${dumpId}`, testsLogger);
          const dumpResponse = expectResult(
            await runtime
              .getDumps()
              .getById(dumpId, { analyse: analyseException }),
            'dumpResponse',
          );
          expect(dumpResponse).toBeDefined();

          logTestStep(
            `read via getRuntimeDumpById(view=summary) (endpoint=/sap/bc/adt/runtime/dump/{id}/summary)`,
            testsLogger,
          );
          logTestStep(
            `read runtime dump summary by id: ${dumpId}`,
            testsLogger,
          );
          const summaryResponse = expectResult(
            await runtime
              .getDumps()
              .getById(dumpId, { analyse: analyseException, view: 'summary' }),
            'summaryResponse',
          );
          expect(summaryResponse).toBeDefined();

          logTestStep(
            `read via getRuntimeDumpById(view=formatted) (endpoint=/sap/bc/adt/runtime/dump/{id}/formatted)`,
            testsLogger,
          );
          logTestStep(
            `read runtime dump formatted by id: ${dumpId}`,
            testsLogger,
          );
          const formattedResponse = expectResult(
            await runtime.getDumps().getById(dumpId, {
              analyse: analyseException,
              view: 'formatted',
            }),
            'formattedResponse',
          );
          expect(formattedResponse).toBeDefined();
        } else {
          throw new Error(
            'generate_artificial_dump is off and there is no dump to read: set params.dump_id or let the run write one',
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
});
