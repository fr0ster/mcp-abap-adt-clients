/**
 * Integration test for Runtime Dumps
 * Tests runtime dump read APIs using AdtRuntimeClient.
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
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
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
  resolvePackageName,
  resolveTransportRequest,
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

function createName(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${stamp}${random}`.slice(0, 30);
}

function buildDumpClassSource(className: string): string {
  return `CLASS ${className} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.
ENDCLASS.

CLASS ${className} IMPLEMENTATION.
  METHOD if_oo_adt_classrun~main.
    DATA lv_num TYPE i VALUE 1.
    DATA lv_den TYPE i VALUE 0.
    DATA lv_res TYPE i.
    lv_res = lv_num / lv_den.
    out->write( |${className} result: ${'${'} lv_res }| ).
  ENDMETHOD.
ENDCLASS.
`;
}

describe('Runtime Dumps (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let executor: AdtExecutor;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
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
        const createArtificialDump = params.generate_artificial_dump !== false;
        const maxAttempts = toPositiveInt(params.retries, 8);
        const retryDelayMs = toPositiveInt(params.retry_delay_ms, 1500);

        const beforeDumpIds = new Set<string>();

        logTestStep('list runtime dumps', testsLogger);
        const listResponse = await runtime.listRuntimeDumps({
          top,
          inlinecount,
        });
        expect(listResponse.status).toBeGreaterThanOrEqual(200);
        expect(listResponse.status).toBeLessThan(300);
        expect(listResponse.data).toBeDefined();

        logTestStep('list runtime dumps by user', testsLogger);
        const byUserResponse = await runtime.listRuntimeDumpsByUser(user, {
          top,
          inlinecount,
        });
        expect(byUserResponse.status).toBeGreaterThanOrEqual(200);
        expect(byUserResponse.status).toBeLessThan(300);
        for (const id of extractDumpIds(listResponse.data)) {
          beforeDumpIds.add(id);
        }
        for (const id of extractDumpIds(byUserResponse.data)) {
          beforeDumpIds.add(id);
        }

        let generatedDumpId: string | undefined;
        let attemptedArtificialDump = false;
        let dumpClassName: string | undefined;
        if (createArtificialDump) {
          const packageName = resolvePackageName(params.package_name);
          const transportRequest = resolveTransportRequest(
            params.transport_request,
          );
          if (!packageName) {
            logTestStep(
              'artificial dump generation skipped (package_name/default_package not configured)',
              testsLogger,
            );
          } else {
            attemptedArtificialDump = true;
            dumpClassName = createName(
              (typeof params.dump_class_prefix === 'string' &&
              params.dump_class_prefix.trim()
                ? params.dump_class_prefix
                : 'ZADT_BLD_DMP'
              )
                .toUpperCase()
                .replace(/[^A-Z0-9_]/g, ''),
            );

            try {
              logTestStep(
                `create dump class ${dumpClassName} (division by zero)`,
                testsLogger,
              );
              await client.getClass().create({
                className: dumpClassName,
                packageName,
                transportRequest,
                description: `Runtime dump probe ${dumpClassName}`,
              });
              await client.getClass().update(
                {
                  className: dumpClassName,
                  sourceCode: buildDumpClassSource(dumpClassName),
                  transportRequest,
                },
                {
                  sourceCode: buildDumpClassSource(dumpClassName),
                  activateOnUpdate: true,
                },
              );

              logTestStep(`run dump class ${dumpClassName}`, testsLogger);
              try {
                await executor.getClassExecutor().run({
                  className: dumpClassName,
                });
              } catch (_runError) {
                // Expected: run should fail and produce dump
              }

              for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                logTestStep(
                  `discover generated dump attempt ${attempt}/${maxAttempts}`,
                  testsLogger,
                );
                const current = await runtime.listRuntimeDumpsByUser(user, {
                  top: Math.max(top, 50),
                  inlinecount,
                });
                const ids = extractDumpIds(current.data);
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
                  `generated dump found: ${generatedDumpId} (source=forced_class_failure)`,
                  testsLogger,
                );
              } else {
                logTestStep(
                  'generated dump not found after retries (source=forced_class_failure)',
                  testsLogger,
                );
              }
            } finally {
              if (dumpClassName) {
                try {
                  await client.getClass().delete({
                    className: dumpClassName,
                    transportRequest,
                  });
                } catch (cleanupError) {
                  testsLogger.warn?.(
                    `cleanup failed for ${dumpClassName}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
                  );
                }
              }
            }
          }
        }

        const configuredDumpId =
          typeof params.dump_id === 'string' && params.dump_id.trim()
            ? params.dump_id.trim()
            : undefined;
        const discoveredDumpId = extractDumpId(listResponse.data);
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
          const dumpResponse = await runtime.getRuntimeDumpById(dumpId);
          expect(dumpResponse.status).toBeGreaterThanOrEqual(200);
          expect(dumpResponse.status).toBeLessThan(300);
          expect(dumpResponse.data).toBeDefined();

          logTestStep(
            `read via getRuntimeDumpById(view=summary) (endpoint=/sap/bc/adt/runtime/dump/{id}/summary)`,
            testsLogger,
          );
          logTestStep(
            `read runtime dump summary by id: ${dumpId}`,
            testsLogger,
          );
          const summaryResponse = await runtime.getRuntimeDumpById(dumpId, {
            view: 'summary',
          });
          expect(summaryResponse.status).toBeGreaterThanOrEqual(200);
          expect(summaryResponse.status).toBeLessThan(300);
          expect(summaryResponse.data).toBeDefined();

          logTestStep(
            `read via getRuntimeDumpById(view=formatted) (endpoint=/sap/bc/adt/runtime/dump/{id}/formatted)`,
            testsLogger,
          );
          logTestStep(
            `read runtime dump formatted by id: ${dumpId}`,
            testsLogger,
          );
          const formattedResponse = await runtime.getRuntimeDumpById(dumpId, {
            view: 'formatted',
          });
          expect(formattedResponse.status).toBeGreaterThanOrEqual(200);
          expect(formattedResponse.status).toBeLessThan(300);
          expect(formattedResponse.data).toBeDefined();
        } else {
          const reason =
            attemptedArtificialDump && createArtificialDump
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
