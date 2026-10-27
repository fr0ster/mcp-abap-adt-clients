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
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
  unitTestRunId,
} from '@mcp-abap-adt/adt-strategies';
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
import {
  isFailureAlert,
  readMethodVerdicts,
  runToCompletion,
} from '../../../helpers/abapUnitRun';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { configuredCase, gate } from '../../../helpers/caseGate';
import { expectResult, releasing } from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
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
  /** Failure alerts at any scope, as `kind@scope`. */
  failures: string[];
  /** Methods carrying at least one alert. */
  failed: string[];
}

function readRunResult(document: string): IRunReading {
  // Parsed, not matched: an alert is found whatever its attribute order.
  const { methods, alerts } = readMethodVerdicts(document);
  return {
    methods: methods.map((m) => m.name).sort(),
    // Every scope: a run- or class-level alert is not dropped.
    alerts: alerts.map((a) => a.kind),
    failures: alerts.filter(isFailureAlert).map((a) => `${a.kind}@${a.scope}`),
    failed: methods
      .filter((m) => m.alerts.length > 0)
      .map((m) => m.name)
      .sort(),
  };
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

  gate('run_unit_test', 'adt_unit_test_sync')(
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
          await cls.read({ className }, undefined, {
            analyse: analyseException,
          }),
          `class ${className}`,
        );
        if (before.present === 'unknown') throw new Error(before.reason);
        if (before.present) {
          logTestStep('delete (leftover)', testsLogger);
          expectResult(
            await cls.delete(config, {
              analyse: judged(analyseDeletion),
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
            {
              analyse: analyseException,
              headers: integrationHeadersOf(cls, 'create'),
            },
          ),
          'create the class',
        );

        try {
          logTestStep('update (source)', testsLogger);
          const handle = String(
            expectResult(
              await cls.lock(config, { analyse: analyseException }),
              'lock',
            ),
          );
          await releasing(
            async () =>
              expectResult(
                await cls.update(config, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(cls, 'update'),
                  source: testCase.params.source_code,
                  lockHandle: handle,
                }),
                'write the class source',
              ),
            () => cls.unlock(config, handle, { analyse: analyseException }),
            'unlock after write the class source',
          );

          logTestStep('update (testclasses)', testsLogger);
          const includeHandle = String(
            expectResult(
              await cls.lock(config, { analyse: analyseException }),
              'lock for testclasses',
            ),
          );
          await releasing(
            async () =>
              expectResult(
                await client.getLocalTestClass().update(config, {
                  analyse: analyseException,
                  headers: integrationHeadersOf(
                    client.getLocalTestClass(),
                    'update',
                  ),
                  source: testCase.params.test_class_source,
                  lockHandle: includeHandle,
                }),
                'write the testclasses include',
              ),
            () =>
              cls.unlock(config, includeHandle, { analyse: analyseException }),
            'unlock after write the testclasses include',
          );

          logTestStep('activate', testsLogger);
          expectResult(
            await cls.activate(config, {
              analyse: judged(analyseActivation),
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
          // The reparse keeps what the run reported, at every scope.
          expect(asyncReading.alerts).toEqual(asyncRun.alerts);

          logTestStep('runSync (synchronous)', testsLogger);
          const syncStarted = Date.now();
          const syncDocument = String(
            expectResult(
              await runner.runSync(className, { analyse: analyseException }),
              'runSync',
            ),
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
          // A fresh object per call: one shared object handed to a helper
          // could be changed before the member call reads it.
          const noHarmless = () => ({ riskLevel: { harmless: false } });
          const asyncFiltered = readRunResult(
            (await runToCompletion(runner, className, noHarmless())).result,
          );
          const syncFiltered = readRunResult(
            String(
              expectResult(
                await runner.runSync(className, {
                  analyse: analyseException,
                  ...noHarmless(),
                }),
                'runSync without harmless tests',
              ),
            ),
          );
          testsLogger.info?.('Harmless excluded', {
            async: asyncFiltered,
            sync: syncFiltered,
          });
          // None ran, and the run itself raised no failure: an empty method
          // list beside a run- or class-level failure is a run that failed,
          // not one that excluded everything.
          expect(asyncFiltered.methods).toEqual([]);
          expect(asyncFiltered.failures).toEqual([]);
          expect(syncFiltered.methods).toEqual([]);
          expect(syncFiltered.failures).toEqual([]);
        } finally {
          logTestStep('delete (cleanup)', testsLogger);
          expectResult(
            await cls.delete(config, {
              analyse: judged(analyseDeletion),
              headers: integrationHeadersOf(cls, 'delete'),
            }),
            'delete the class',
          );
          const after = presenceOf(
            await cls.read({ className }, undefined, {
              analyse: analyseException,
            }),
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
