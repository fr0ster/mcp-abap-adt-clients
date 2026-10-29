/**
 * Live: a package's ABAP Unit tests through the generic runner
 * (`AdtExecutor.getAbapUnitTestRunner()`), named as a package target — an
 * `osl:packageSet`, the one form measured to run a package's tests.
 *
 * Creates a class with one passing test in the local package of its case,
 * under a fresh name, runs the package (without subpackages), asserts that
 * test ran, deletes the class and reads back its absence. Other tests the
 * package holds may run too; only this one is asserted.
 *
 * Run: npm test -- --testPathPatterns=unitTest/AbapUnitPackageRun
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
import { abapUnitTestRunnerDocuments } from '../../../../executors/abapUnitTestRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  classSources,
  createClassWithTests,
  freshSuffix,
  noProbesOwned,
  PROBE_TEST_METHOD,
  probePlace,
  ranMethods,
  removeOwned,
} from '../../../helpers/abapUnitProbes';
import {
  readMethodVerdicts,
  runToCompletion,
} from '../../../helpers/abapUnitRun';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { raiseAfterCleanup } from '../../../helpers/contract';
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
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

const SECTION = 'run_abap_unit';
const CASE = 'adt_abap_unit_package_run';
const TITLE = 'AbapUnitPackageRun - a package by package target';

describe('ABAP Unit: a package by package target (AdtExecutor.getAbapUnitTestRunner)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
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

  gate(SECTION, CASE)(
    'runs the test of a class in the package',
    async () => {
      const testCase = configuredCase(SECTION, CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CASE));
      const place = probePlace(testCase.params ?? {});
      const className = `ZCL_AUG${freshSuffix()}`;
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { className, packageName: place.packageName },
      });

      // What this run created, and so may delete: nothing yet.
      const owned = noProbesOwned();
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the class and its test', testsLogger);
        await createClassWithTests(
          client,
          place,
          owned,
          className,
          classSources(className),
        );

        logTestStep('run (package target)', testsLogger);
        const runner = new AdtExecutor(
          connection,
          libraryLogger,
        ).getAbapUnitTestRunner({
          ...abapUnitTestRunnerDocuments,
          run: unitTestRunId,
        });
        const run = await runToCompletion(runner, {
          kind: 'package',
          name: place.packageName,
          includeSubpackages: false,
        });
        testsLogger.info?.(`Run ${run.runId}: ${run.methods.join(', ')}`);
        const ours = ranMethods(readMethodVerdicts(run.result).methods).filter(
          (method) => method.testClass === 'LTC_PROBE',
        );
        // The class is the run's evidence: its test class by name, under the
        // program the result names for it.
        expect(run.result.toUpperCase()).toContain(className);
        expect(ours).toContainEqual({
          testClass: 'LTC_PROBE',
          name: PROBE_TEST_METHOD,
          alerts: [],
        });
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      logTestStep('delete and read back (cleanup)', testsLogger);
      const refusals = await removeOwned(client, place, owned);
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});
