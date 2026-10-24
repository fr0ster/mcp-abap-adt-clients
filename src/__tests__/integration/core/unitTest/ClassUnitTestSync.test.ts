/**
 * A class's ABAP Unit tests through both runners, compared: the asynchronous
 * one (`run` on /abapunit/runs, then `getStatus` and `getResult`) and the
 * synchronous one (`runSync` on /abapunit/testruns, the finished result in one
 * answer). One test passes and one fails on purpose, as in
 * fr0ster/mcp-abap-adt#286, so the comparison covers an alert as well as a
 * pass.
 *
 * The class is created here and deleted at the end, and its absence is read
 * back. `UNIT_SYNC_REPORT=<file>` appends one JSON line per run with what each
 * runner found and how long it took.
 *
 * Run: npm test -- integration/core/unitTest/ClassUnitTestSync
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { unitTestRunId } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { classTestRunnerDocuments } from '../../../../executors/class/ClassTestRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { runToCompletion } from '../../../helpers/abapUnitRun';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  gateAll,
  gateOn,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import { presenceOf } from '../../../helpers/objectPresence';
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
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const TITLE = 'UnitTest - asynchronous and synchronous runners compared';

/** What a result document says: the methods that ran, and the alerts. */
interface IRunReading {
  methods: string[];
  /** `kind` of every alert. */
  alerts: string[];
  /** Methods carrying at least one alert. */
  failed: string[];
}

function readRunResult(document: string): IRunReading {
  const methods: string[] = [];
  const failed: string[] = [];
  const alerts: string[] = [];
  // A method is either self-closing or closes after its alerts.
  for (const m of document.matchAll(
    /<testMethod [^>]*adtcore:name="([^"]+)"[^>]*?(\/>|>([\s\S]*?)<\/testMethod>)/g,
  )) {
    methods.push(m[1]);
    const kinds = [...(m[3] ?? '').matchAll(/<alert kind="([^"]+)"/g)].map(
      (a) => a[1],
    );
    if (kinds.length > 0) failed.push(m[1]);
    alerts.push(...kinds);
  }
  return { methods: methods.sort(), alerts, failed: failed.sort() };
}

/** The result document's root element and its namespace, for the report. */
function rootOf(document: string): string {
  const root = /<([A-Za-z]+:runResult)\b[^>]*?xmlns:[A-Za-z]+="([^"]+)"/.exec(
    document,
  );
  return root ? `${root[1]} ${root[2]}` : document.slice(0, 120);
}

describe('ABAP Unit on a class: run (async) and runSync (sync)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const resolved = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolved.client;
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gateAll(
    gate('run_unit_test', 'adt_unit_test_sync'),
    // The legacy runner's `run` is the synchronous request already; there is
    // no asynchronous one to compare it with.
    gateOn(({ isLegacy }) => !isLegacy),
  )(
    'both runners find the same tests, the same failure and the same alert',
    async () => {
      const testCase = configuredCase('run_unit_test', 'adt_unit_test_sync');
      logTestStart(testsLogger, TITLE, {
        name: 'adt_unit_test_sync',
        params: {},
      });
      try {
        if (!testCase?.params?.container_class) {
          throw new Error(
            'adt_unit_test_sync not in test-config.yaml (npm run check:config)',
          );
        }

        const className: string = testCase.params.container_class;
        const packageName = resolvePackageName(testCase.params.package_name);
        const transportRequest = resolveTransportRequest(
          testCase.params.transport_request,
        );
        const config = { className, transportRequest };
        const cls = client.getClass();

        // Idempotent: a class left by an earlier, interrupted run goes first.
        const before = presenceOf(
          await cls.read({ className }),
          `class ${className}`,
        );
        if (before.present === 'unknown') throw new Error(before.reason);
        if (before.present) {
          logTestStep('delete (leftover)', testsLogger);
          expectResult(
            await cls.delete(config, {
              headers: integrationHeadersOf(cls, 'delete'),
            }),
            'delete the leftover class',
          );
        }

        logTestStep('create', testsLogger);
        expectResult(
          await cls.create(
            {
              className,
              packageName,
              transportRequest,
              description: 'ABAP Unit: async and sync runners',
            },
            { headers: integrationHeadersOf(cls, 'create') },
          ),
          'create the class',
        );

        try {
          logTestStep('update (source)', testsLogger);
          const handle = String(expectResult(await cls.lock(config), 'lock'));
          try {
            expectResult(
              await cls.update(config, {
                headers: integrationHeadersOf(cls, 'update'),
                source: testCase.params.source_code,
                lockHandle: handle,
              }),
              'write the class source',
            );
          } finally {
            await cls.unlock(config, handle);
          }

          logTestStep('update (testclasses)', testsLogger);
          const includeHandle = String(
            expectResult(await cls.lock(config), 'lock for testclasses'),
          );
          try {
            expectResult(
              await client.getLocalTestClass().update(config, {
                headers: integrationHeadersOf(
                  client.getLocalTestClass(),
                  'update',
                ),
                source: testCase.params.test_class_source,
                lockHandle: includeHandle,
              }),
              'write the testclasses include',
            );
          } finally {
            await cls.unlock(config, includeHandle);
          }

          logTestStep('activate', testsLogger);
          expectResult(
            await cls.activate(config, {
              headers: integrationHeadersOf(cls, 'activate'),
            }),
            'activate the class',
          );

          const runner = new AdtExecutor(
            connection,
            libraryLogger,
          ).getClassTestRunner({
            ...classTestRunnerDocuments,
            run: unitTestRunId,
          });

          logTestStep('run (asynchronous)', testsLogger);
          const asyncStarted = Date.now();
          const asyncRun = await runToCompletion(runner, className);
          const asyncMs = Date.now() - asyncStarted;
          const asyncReading = readRunResult(asyncRun.result);

          logTestStep('runSync (synchronous)', testsLogger);
          const syncStarted = Date.now();
          const syncDocument = String(
            expectResult(await runner.runSync(className), 'runSync'),
          );
          const syncMs = Date.now() - syncStarted;
          const syncReading = readRunResult(syncDocument);

          const report = {
            system: isCloudSystem ? 'cloud' : 'onprem',
            async: {
              ...asyncReading,
              root: rootOf(asyncRun.result),
              ms: asyncMs,
            },
            sync: { ...syncReading, root: rootOf(syncDocument), ms: syncMs },
          };
          testsLogger.info?.('Runners compared', report);
          if (process.env.UNIT_SYNC_REPORT) {
            fs.appendFileSync(
              process.env.UNIT_SYNC_REPORT,
              `${JSON.stringify(report)}\n`,
            );
          }

          const expected = {
            methods: [
              testCase.params.passing_method,
              testCase.params.failing_method,
            ].sort(),
            failed: [testCase.params.failing_method],
          };
          expect(asyncReading.methods).toEqual(expected.methods);
          expect(asyncReading.failed).toEqual(expected.failed);
          expect(asyncReading.alerts).toEqual(['failedAssertion']);
          expect(syncReading).toEqual(asyncReading);

          // The options are sent, not dropped: the tests are RISK LEVEL
          // HARMLESS, so a run that excludes harmless runs none of them — on
          // both runners.
          logTestStep('both runners, harmless excluded', testsLogger);
          const noHarmless = { riskLevel: { harmless: false } };
          const asyncFiltered = readRunResult(
            (await runToCompletion(runner, className, noHarmless)).result,
          );
          const syncFiltered = readRunResult(
            String(
              expectResult(
                await runner.runSync(className, noHarmless),
                'runSync without harmless tests',
              ),
            ),
          );
          testsLogger.info?.('Harmless excluded', {
            async: asyncFiltered,
            sync: syncFiltered,
          });
          expect(asyncFiltered.methods).toEqual([]);
          expect(syncFiltered.methods).toEqual([]);
        } finally {
          logTestStep('delete (cleanup)', testsLogger);
          expectResult(
            await cls.delete(config, {
              headers: integrationHeadersOf(cls, 'delete'),
            }),
            'delete the class',
          );
          const after = presenceOf(
            await cls.read({ className }),
            `class ${className}`,
          );
          expect(after).toEqual({ present: false });
        }
        logTestSuccess(testsLogger, TITLE);
      } finally {
        logTestEnd(testsLogger, TITLE);
      }
    },
    getTimeout('test'),
  );
});
