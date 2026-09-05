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
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
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
  let hasConfig = false;

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
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  it(
    'should read dumps feed and optionally dump payload by ID',
    async () => {
      const testName = 'Runtime Dumps - read';
      const testCase = getEnabledTestCase('runtime_dumps', 'adt_runtime_dumps');

      logTestStart(testsLogger, testName, {
        name: 'adt_runtime_dumps',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_dumps/adt_runtime_dumps not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
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
          await runtime.getDumps().list({
            top,
            inlinecount,
          }),
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
          await runtime.getDumps().listByUser(user, {
            top,
            inlinecount,
          }),
          'byUserResponse',
        );

        logTestStep(
          'list runtime dumps by user with from/to filter',
          testsLogger,
        );
        const byUserFilteredResponse = expectResult(
          await runtime.getDumps().listByUser(user, {
            top,
            inlinecount,
            from: fromDate,
            to: toDate,
          }),
          'byUserFilteredResponse',
        );
        for (const id of extractDumpIds(listResponse)) {
          beforeDumpIds.add(id);
        }
        for (const id of extractDumpIds(byUserResponse)) {
          beforeDumpIds.add(id);
        }

        let generatedDumpId: string | undefined;
        if (generateArtificialDump) {
          const className = resolveDumpClassName(params);
          logTestStep(
            `run shared dump class ${className} (division by zero)`,
            testsLogger,
          );
          try {
            await executor.getClassExecutor().run({ className });
          } catch (_runError) {
            // Expected: run should fail and produce dump
          }

          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            logTestStep(
              `discover generated dump attempt ${attempt}/${maxAttempts}`,
              testsLogger,
            );
            const current = expectResult(
              await runtime.getDumps().listByUser(user, {
                top: Math.max(top, 50),
                inlinecount,
              }),
              'current',
            );
            const ids = extractDumpIds(current);
            generatedDumpId = ids.find((id) => !beforeDumpIds.has(id));
            if (generatedDumpId) {
              break;
            }
            if (attempt < maxAttempts) {
              await delay(retryDelayMs);
            }
          }
          if (generatedDumpId) {
            logTestStep(
              `generated dump found: ${generatedDumpId}`,
              testsLogger,
            );
          } else {
            logTestStep('generated dump not found after retries', testsLogger);
          }
        }

        const configuredDumpId =
          typeof params.dump_id === 'string' && params.dump_id.trim()
            ? params.dump_id.trim()
            : undefined;
        const discoveredDumpId = extractDumpId(listResponse);
        const dumpId = generatedDumpId || configuredDumpId || discoveredDumpId;
        const dumpIdSource = generatedDumpId
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
            await runtime.getDumps().getById(dumpId),
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
            await runtime.getDumps().getById(dumpId, {
              view: 'summary',
            }),
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
              view: 'formatted',
            }),
            'formattedResponse',
          );
          expect(formattedResponse).toBeDefined();
        } else {
          const reason = generateArtificialDump
            ? 'forced dump was not discovered and no fallback dump_id/feed id'
            : 'no dump id configured/discovered';
          logTestStep(
            `read runtime dump by id: skipped (${reason})`,
            testsLogger,
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
