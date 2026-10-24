/**
 * The ABAP Unit tests of reports, a function group and its modules through
 * both runners, compared: the asynchronous one (`run` on /abapunit/runs, then
 * `getStatus` and `getResult`) and the synchronous one (`runSync` on
 * /abapunit/testruns, with `<options>`, the finished result in one answer).
 * Every test class has a test that passes and one that fails on purpose, so
 * the comparison covers an alert as well as a pass.
 *
 * Reports: one with its test class in its own source, one that pulls it in
 * from an include. Function group: two modules, and a test include with two
 * test classes — LTC_MODULE calls the first module, LTC_OTHER calls none — so
 * a module's run shows whether it keeps to the tests that exercise the module.
 * Measured on premise (SAP_BASIS 816, 2026-10-23): it does not, on either
 * runner — every module's run, the untested one's included, ran the group's
 * every test.
 *
 * Every object is created here and deleted at the end, and its absence is read
 * back. `UNIT_SYNC_REPORT=<file>` appends one JSON line per object with what
 * each runner found and how long it took.
 *
 * Run: npm test -- integration/core/unitTest/ProgramFunctionUnitTestSync
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  unitTestRunId,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { AdtExecutor } from '../../../../clients/AdtExecutor';
import { abapUnitRunnerDocuments } from '../../../../executors/abapUnitRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  isFailureAlert,
  readMethodVerdicts,
  runToCompletion,
} from '../../../helpers/abapUnitRun';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  gateAll,
  gateOn,
} from '../../../helpers/caseGate';
import { expectResult, releasing } from '../../../helpers/contract';
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

/** What a result document says: the methods that ran, and the alerts. */
interface IRunReading {
  /** `TESTCLASS.METHOD`, sorted. */
  methods: string[];
  /** `kind` of every alert. */
  alerts: string[];
  /** Failure alerts at any scope, as `kind@scope`. */
  failures: string[];
  /** Methods carrying at least one alert, as `TESTCLASS.METHOD`, sorted. */
  failed: string[];
  /** `adtcore:type` of every `program` element: what the run reported on. */
  programTypes: string[];
}

function readRunResult(document: string): IRunReading {
  // Parsed, not matched: an alert is found whatever its attribute order.
  const { methods, alerts, programTypes } = readMethodVerdicts(document);
  const named = (m: { testClass: string; name: string }) =>
    `${m.testClass}.${m.name}`;
  return {
    methods: methods.map(named).sort(),
    // Every scope: a run- or class-level alert is not dropped.
    alerts: alerts.map((a) => a.kind),
    failures: alerts.filter(isFailureAlert).map((a) => `${a.kind}@${a.scope}`),
    failed: methods
      .filter((m) => m.alerts.length > 0)
      .map(named)
      .sort(),
    programTypes,
  };
}

interface IRunner<T> {
  run(target: T, options?: object): Promise<IAdtResponse<unknown>>;
  getStatus(
    runId: string,
    withLongPolling?: boolean,
  ): Promise<IAdtResponse<unknown>>;
  getResult(runId: string): Promise<IAdtResponse<unknown>>;
}

interface ICompared {
  object: string;
  async: IRunReading & { ms: number };
  sync: IRunReading & { ms: number };
}

/** One object through both runners, read the same way. */
async function compare<T>(
  object: string,
  runner: IRunner<T>,
  target: T,
  runSync: () => Promise<IAdtResponse<unknown>>,
): Promise<ICompared> {
  const asyncStarted = Date.now();
  const asyncRun = await runToCompletion(runner, target);
  const asyncMs = Date.now() - asyncStarted;

  const syncStarted = Date.now();
  const syncDocument = String(
    expectResult(await runSync(), `runSync ${object}`),
  );
  const syncMs = Date.now() - syncStarted;

  const compared = {
    object,
    async: { ...readRunResult(asyncRun.result), ms: asyncMs },
    sync: { ...readRunResult(syncDocument), ms: syncMs },
  };
  testsLogger.info?.('Runners compared', compared);
  if (process.env.UNIT_SYNC_REPORT) {
    fs.appendFileSync(
      process.env.UNIT_SYNC_REPORT,
      `${JSON.stringify(compared)}\n`,
    );
  }
  return compared;
}

/** The parts of a reading both runners must agree on. */
function verdicts(reading: IRunReading) {
  return {
    methods: reading.methods,
    alerts: reading.alerts,
    failed: reading.failed,
  };
}

describe('ABAP Unit on reports and function groups: run (async) and runSync (sync)', () => {
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

  /** The test case, configured with the parameter the test cannot run without. */
  function configuredOrFail(section: string, name: string, required: string) {
    const testCase = configuredCase(section, name);
    if (!testCase?.params?.[required]) {
      throw new Error(`${name} not in test-config.yaml (npm run check:config)`);
    }
    return testCase;
  }

  // The legacy runner's `run` is the synchronous request already; there is no
  // asynchronous one to compare it with.
  const notLegacy = gateOn(({ isLegacy }) => !isLegacy);

  gateAll(
    gate('run_program_unit_test', 'adt_program_unit_test_sync'),
    notLegacy,
  )(
    'reports: both runners find the same tests, the same failure and the same alert',
    async () => {
      const TITLE = 'UnitTest - reports, async and sync compared';
      logTestStart(testsLogger, TITLE, {
        name: 'adt_program_unit_test_sync',
        params: {},
      });
      try {
        const testCase = configuredOrFail(
          'run_program_unit_test',
          'adt_program_unit_test_sync',
          'own_program_name',
        );
        const params = testCase.params;
        const packageName = resolvePackageName(params.package_name);
        const transportRequest = resolveTransportRequest(
          params.transport_request,
        );
        const program = client.getProgram();
        const include = client.getInclude();
        const ownProgram = { programName: params.own_program_name as string };
        const inclProgram = {
          programName: params.include_program_name as string,
        };
        const incl = { includeName: params.include_name as string };

        const deletePrograms = async () => {
          for (const p of [ownProgram, inclProgram]) {
            const there = presenceOf(
              await program.read(p),
              `program ${p.programName}`,
            );
            if (there.present === 'unknown') throw new Error(there.reason);
            if (there.present) {
              expectResult(
                await program.delete(
                  { ...p, transportRequest },
                  {
                    analyse: analyseDeletion,
                    headers: integrationHeadersOf(program, 'delete'),
                  },
                ),
                `delete ${p.programName}`,
              );
            }
          }
          const there = presenceOf(
            await include.read(incl),
            `include ${incl.includeName}`,
          );
          if (there.present === 'unknown') throw new Error(there.reason);
          if (there.present) {
            expectResult(
              await include.delete(
                { ...incl, transportRequest },
                {
                  analyse: analyseDeletion,
                  headers: integrationHeadersOf(include, 'delete'),
                },
              ),
              `delete ${incl.includeName}`,
            );
          }
        };

        // Idempotent: objects left by an earlier, interrupted run go first.
        logTestStep('delete (leftovers)', testsLogger);
        await deletePrograms();

        try {
          logTestStep('create include', testsLogger);
          expectResult(
            await include.create(
              {
                ...incl,
                packageName,
                transportRequest,
                description: 'ABAP Unit: async and sync runners',
              },
              { headers: integrationHeadersOf(include, 'create') },
            ),
            'create include',
          );
          const includeHandle = String(
            expectResult(await include.lock(incl), 'lock include'),
          );
          await releasing(
            async () =>
              expectResult(
                await include.update(
                  { ...incl, transportRequest },
                  {
                    headers: integrationHeadersOf(include, 'update'),
                    lockHandle: includeHandle,
                    source: params.include_source,
                  },
                ),
                'write the include',
              ),
            () => include.unlock(incl, includeHandle),
            'unlock after write the include',
          );

          for (const [p, source] of [
            [ownProgram, params.own_program_source],
            [inclProgram, params.include_program_source],
          ] as const) {
            logTestStep(`create ${p.programName}`, testsLogger);
            expectResult(
              await program.create(
                {
                  ...p,
                  packageName,
                  transportRequest,
                  description: 'ABAP Unit: async and sync runners',
                },
                { headers: integrationHeadersOf(program, 'create') },
              ),
              `create ${p.programName}`,
            );
            const handle = String(
              expectResult(await program.lock(p), `lock ${p.programName}`),
            );
            await releasing(
              async () =>
                expectResult(
                  await program.update(
                    { ...p, transportRequest },
                    {
                      headers: integrationHeadersOf(program, 'update'),
                      lockHandle: handle,
                      source,
                    },
                  ),
                  `write ${p.programName}`,
                ),
              () => program.unlock(p, handle),
              `unlock after write ${p.programName}`,
            );
          }

          logTestStep('activate', testsLogger);
          expectResult(
            await include.activate(incl, {
              analyse: analyseActivation,
              headers: integrationHeadersOf(include, 'activate'),
            }),
            'activate include',
          );
          for (const p of [ownProgram, inclProgram]) {
            expectResult(
              await program.activate(p, {
                analyse: analyseActivation,
                headers: integrationHeadersOf(program, 'activate'),
              }),
              `activate ${p.programName}`,
            );
          }

          const runner = new AdtExecutor(
            connection,
            libraryLogger,
          ).getProgramTestRunner({
            ...abapUnitRunnerDocuments,
            run: unitTestRunId,
          });

          for (const [p, testClass] of [
            [ownProgram, 'LTC_OWN'],
            [inclProgram, 'LTC_INCL'],
          ] as const) {
            logTestStep(`run and runSync ${p.programName}`, testsLogger);
            const compared = await compare(
              `PROG ${p.programName}`,
              runner,
              p.programName,
              () => runner.runSync(p.programName),
            );
            expect(verdicts(compared.async)).toEqual({
              methods: [
                `${testClass}.${params.failing_method}`,
                `${testClass}.${params.passing_method}`,
              ],
              alerts: ['failedAssertion'],
              failed: [`${testClass}.${params.failing_method}`],
            });
            expect(verdicts(compared.sync)).toEqual(verdicts(compared.async));
          }

          // The options are sent, not dropped: the tests are RISK LEVEL
          // HARMLESS, so a run that excludes harmless runs none of them.
          logTestStep('runSync, harmless excluded', testsLogger);
          const filtered = readRunResult(
            String(
              expectResult(
                await runner.runSync(ownProgram.programName, {
                  riskLevel: { harmless: false },
                }),
                'runSync without harmless tests',
              ),
            ),
          );
          // None ran, and the run itself raised no failure.
          expect(filtered.methods).toEqual([]);
          expect(filtered.failures).toEqual([]);
        } finally {
          logTestStep('delete (cleanup)', testsLogger);
          await deletePrograms();
          for (const p of [ownProgram, inclProgram]) {
            expect(
              presenceOf(await program.read(p), `program ${p.programName}`),
            ).toEqual({ present: false });
          }
          expect(
            presenceOf(await include.read(incl), `include ${incl.includeName}`),
          ).toEqual({ present: false });
        }
        logTestSuccess(testsLogger, TITLE);
      } finally {
        logTestEnd(testsLogger, TITLE);
      }
    },
    getTimeout('test'),
  );

  gateAll(
    gate('run_function_group_unit_test', 'adt_function_group_unit_test_sync'),
    notLegacy,
  )(
    'function group and modules: both runners compared, and what a module run covers',
    async () => {
      const TITLE = 'UnitTest - function group and modules, async and sync';
      logTestStart(testsLogger, TITLE, {
        name: 'adt_function_group_unit_test_sync',
        params: {},
      });
      try {
        const testCase = configuredOrFail(
          'run_function_group_unit_test',
          'adt_function_group_unit_test_sync',
          'function_group_name',
        );
        const params = testCase.params;
        const packageName = resolvePackageName(params.package_name);
        const transportRequest = resolveTransportRequest(
          params.transport_request,
        );
        const functionGroupName: string = params.function_group_name;
        const group = { functionGroupName };
        const module = {
          functionGroupName,
          functionModuleName: params.function_module_name as string,
        };
        const untested = {
          functionGroupName,
          functionModuleName: params.untested_module_name as string,
        };
        const include = {
          functionGroupName,
          includeName: params.include_name as string,
        };
        const fugr = client.getFunctionGroup();
        const fm = client.getFunctionModule();
        const finc = client.getFunctionInclude();

        const deleteGroup = async () => {
          const there = presenceOf(
            await fugr.readMetadata(group),
            `function group ${functionGroupName}`,
          );
          if (there.present === 'unknown') throw new Error(there.reason);
          if (there.present) {
            expectResult(
              await fugr.delete(
                { ...group, transportRequest },
                {
                  analyse: analyseDeletion,
                  headers: integrationHeadersOf(fugr, 'delete'),
                },
              ),
              `delete ${functionGroupName}`,
            );
          }
        };

        logTestStep('delete (leftover)', testsLogger);
        await deleteGroup();

        try {
          logTestStep('create group', testsLogger);
          expectResult(
            await fugr.create(
              {
                ...group,
                packageName,
                transportRequest,
                description: 'ABAP Unit: async and sync runners',
              },
              { headers: integrationHeadersOf(fugr, 'create') },
            ),
            'create group',
          );
          for (const [m, source] of [
            [module, params.function_module_source],
            [untested, params.untested_module_source],
          ] as const) {
            logTestStep(`create ${m.functionModuleName}`, testsLogger);
            expectResult(
              await fm.create(
                {
                  ...m,
                  transportRequest,
                  description: 'ABAP Unit: async and sync runners',
                },
                { headers: integrationHeadersOf(fm, 'create') },
              ),
              `create ${m.functionModuleName}`,
            );
            const handle = String(
              expectResult(await fm.lock(m), `lock ${m.functionModuleName}`),
            );
            await releasing(
              async () =>
                expectResult(
                  await fm.update(
                    { ...m, transportRequest },
                    {
                      headers: integrationHeadersOf(fm, 'update'),
                      lockHandle: handle,
                      source,
                    },
                  ),
                  `write ${m.functionModuleName}`,
                ),
              () => fm.unlock(m, handle),
              `unlock after write ${m.functionModuleName}`,
            );
          }

          logTestStep('create test include', testsLogger);
          expectResult(
            await finc.create(
              {
                ...include,
                transportRequest,
                description: 'ABAP Unit tests',
              },
              { headers: integrationHeadersOf(finc, 'create') },
            ),
            'create include',
          );
          const includeHandle = String(
            expectResult(await finc.lock(include), 'lock include'),
          );
          await releasing(
            async () =>
              expectResult(
                await finc.update(
                  { ...include, transportRequest },
                  {
                    headers: integrationHeadersOf(finc, 'update'),
                    lockHandle: includeHandle,
                    source: params.include_source,
                  },
                ),
                'write the test classes',
              ),
            () => finc.unlock(include, includeHandle),
            'unlock after write the test classes',
          );

          logTestStep('activate', testsLogger);
          for (const m of [module, untested]) {
            expectResult(
              await fm.activate(m, {
                analyse: analyseActivation,
                headers: integrationHeadersOf(fm, 'activate'),
              }),
              `activate ${m.functionModuleName}`,
            );
          }
          expectResult(
            await finc.activate(include, {
              analyse: analyseActivation,
              headers: integrationHeadersOf(finc, 'activate'),
            }),
            'activate include',
          );
          expectResult(
            await fugr.activate(group, {
              analyse: analyseActivation,
              headers: integrationHeadersOf(fugr, 'activate'),
            }),
            'activate group',
          );

          const executor = new AdtExecutor(connection, libraryLogger);
          const documents = { ...abapUnitRunnerDocuments, run: unitTestRunId };
          const groupRunner = executor.getFunctionGroupTestRunner(documents);
          const moduleRunner = executor.getFunctionModuleTestRunner(documents);

          const moduleMethods = (params.module_methods as string[]).map(
            (m) => `LTC_MODULE.${m}`,
          );
          const otherMethods = (params.other_methods as string[]).map(
            (m) => `LTC_OTHER.${m}`,
          );
          const failed = [`LTC_MODULE.${params.failing_method}`];

          logTestStep('run and runSync (group)', testsLogger);
          const groupRun = await compare(
            `FUGR ${functionGroupName}`,
            groupRunner,
            functionGroupName,
            () => groupRunner.runSync(functionGroupName),
          );
          expect(verdicts(groupRun.async)).toEqual({
            methods: [...moduleMethods, ...otherMethods].sort(),
            alerts: ['failedAssertion'],
            failed,
          });
          expect(verdicts(groupRun.sync)).toEqual(verdicts(groupRun.async));

          logTestStep('run and runSync (module under test)', testsLogger);
          const moduleRun = await compare(
            `FUNC ${module.functionModuleName}`,
            moduleRunner,
            module.functionModuleName,
            () => moduleRunner.runSync(module),
          );

          logTestStep(
            'run and runSync (module no test exercises)',
            testsLogger,
          );
          const untestedRun = await compare(
            `FUNC ${untested.functionModuleName}`,
            moduleRunner,
            untested.functionModuleName,
            () => moduleRunner.runSync(untested),
          );

          // Measured on premise (SAP_BASIS 816, 2026-10-23): neither runner
          // keeps to the tests that exercise the module. A module's run, on
          // /runs (`osl:object type="FUNC"`) and on /testruns (the module's
          // URI) alike, runs every test of its group — LTC_OTHER, which calls
          // no module, included — and so does the run of a module no test
          // calls. /testruns reports the group (`FUGR/F`). These expectations
          // record that; a system that filters turns them red.
          testsLogger.info?.('What a module run covers', {
            moduleAsync: moduleRun.async.methods,
            moduleSync: moduleRun.sync.methods,
            untestedAsync: untestedRun.async.methods,
            untestedSync: untestedRun.sync.methods,
          });
          for (const run of [moduleRun, untestedRun]) {
            expect(verdicts(run.async)).toEqual(verdicts(groupRun.async));
            expect(verdicts(run.sync)).toEqual(verdicts(groupRun.sync));
            expect(run.sync.programTypes).toEqual(['FUGR/F']);
          }
        } finally {
          logTestStep('delete (cleanup)', testsLogger);
          await deleteGroup();
          expect(
            presenceOf(
              await fugr.readMetadata(group),
              `function group ${functionGroupName}`,
            ),
          ).toEqual({ present: false });
          for (const m of [module, untested]) {
            expect(
              presenceOf(
                await fm.readMetadata(m),
                `module ${m.functionModuleName}`,
              ),
            ).toEqual({ present: false });
          }
        }
        logTestSuccess(testsLogger, TITLE);
      } finally {
        logTestEnd(testsLogger, TITLE);
      }
    },
    getTimeout('test'),
  );
});
