/**
 * Live: a class's ABAP Unit tests through the generic runner
 * (`AdtExecutor.getAbapUnitTestRunner()`), named as an object target of type
 * `CLAS/OC` — not the `CLAS` the class runner sends.
 *
 * Creates a class with one passing test in the local package of its case,
 * under a fresh name, runs it, deletes it and reads back its absence.
 *
 * Run: npm test -- --testPathPatterns=unitTest/AbapUnitClassRun
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
const CASE = 'adt_abap_unit_class_run';
const TITLE =
  'AbapUnitClassRun - a class by CLAS/OC through the generic runner';

describe('ABAP Unit: a class by object target CLAS/OC (AdtExecutor.getAbapUnitTestRunner)', () => {
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
    'runs the test of a class named as CLAS/OC',
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

        logTestStep('run (object target CLAS/OC)', testsLogger);
        const runner = new AdtExecutor(
          connection,
          libraryLogger,
        ).getAbapUnitTestRunner({
          ...abapUnitTestRunnerDocuments,
          run: unitTestRunId,
        });
        const run = await runToCompletion(runner, {
          kind: 'object',
          name: className,
          type: 'CLAS/OC',
        });
        testsLogger.info?.(`Run ${run.runId}: ${run.methods.join(', ')}`);
        const verdicts = ranMethods(readMethodVerdicts(run.result).methods);
        expect(verdicts).toEqual([
          { testClass: 'LTC_PROBE', name: PROBE_TEST_METHOD, alerts: [] },
        ]);
        expect(run.failures).toEqual([]);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      // Cleanup deletes only what this run created — a refused create
      // leaves the object of that name alone — and reads the absence back.
      logTestStep('delete and read back (cleanup)', testsLogger);
      const refusals = await removeOwned(client, place, owned);
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});
