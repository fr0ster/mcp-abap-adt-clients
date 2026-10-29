/**
 * Live: a CDS view's assigned tests through the generic runner
 * (`AdtExecutor.getAbapUnitTestRunner()`), named as an object target of type
 * `DDLS/DF`.
 *
 * A view holds no test class: its tests are local test classes elsewhere
 * marked `"! @testing <view>`, here in a container class's testclasses
 * include. They are assigned tests, so they run only when the scope sets
 * `foreignTests: true`; with own tests only, the run's result is empty — the
 * endpoint answers it, it refuses nothing.
 *
 * Creates the view (over `I_Language`, key `Language`) and the container
 * class in the local package of its case, under fresh names, runs both
 * scopes, deletes both and reads back their absence.
 *
 * Run: npm test -- --testPathPatterns=unitTest/AbapUnitCdsRun
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
  assignedTestSources,
  createClassWithTests,
  createView,
  freshSuffix,
  PROBE_TEST_METHOD,
  probePlace,
  ranMethods,
  removeClass,
  removeView,
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
const CASE = 'adt_abap_unit_cds_run';
const TITLE = "AbapUnitCdsRun - a CDS view's assigned tests by DDLS/DF";

describe("ABAP Unit: a CDS view's assigned tests by object target DDLS/DF (AdtExecutor.getAbapUnitTestRunner)", () => {
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
    'runs the assigned test with foreignTests, and nothing with own tests only',
    async () => {
      const testCase = configuredCase(SECTION, CASE);
      if (!testCase) throw new Error(missingCaseMessage(SECTION, CASE));
      const place = probePlace(testCase.params ?? {});
      const suffix = freshSuffix();
      const viewName = `ZI_AUG${suffix}`;
      const className = `ZCL_AUG${suffix}`;
      logTestStart(testsLogger, TITLE, {
        name: CASE,
        params: { viewName, className, packageName: place.packageName },
      });

      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the view', testsLogger);
        await createView(client, place, viewName);
        logTestStep('create the container class and its test', testsLogger);
        await createClassWithTests(
          client,
          place,
          className,
          assignedTestSources(className, viewName),
        );

        const runner = new AdtExecutor(
          connection,
          libraryLogger,
        ).getAbapUnitTestRunner({
          ...abapUnitTestRunnerDocuments,
          run: unitTestRunId,
        });
        const target = {
          kind: 'object',
          name: viewName,
          type: 'DDLS/DF',
        } as const;

        logTestStep('run (DDLS/DF, foreignTests)', testsLogger);
        const assigned = await runToCompletion(runner, target, {
          scope: { ownTests: true, foreignTests: true },
        });
        testsLogger.info?.(
          `Run ${assigned.runId}: ${assigned.methods.join(', ')}`,
        );
        expect(ranMethods(readMethodVerdicts(assigned.result).methods)).toEqual(
          [{ testClass: 'LTC_VIEW', name: PROBE_TEST_METHOD, alerts: [] }],
        );
        expect(assigned.failures).toEqual([]);

        logTestStep('run (DDLS/DF, own tests only)', testsLogger);
        const own = await runToCompletion(runner, target, {
          scope: { ownTests: true, foreignTests: false },
        });
        expect(own.methods).toEqual([]);
        expect(own.alerts).toEqual([]);
        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      // Cleanup runs whatever the body did, and reads the absence back: the
      // class that names the view first, then the view.
      logTestStep('delete and read back (cleanup)', testsLogger);
      const refusals = [
        await removeClass(client, place, className),
        await removeView(client, place, viewName),
      ];
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});
