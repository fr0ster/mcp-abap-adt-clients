/**
 * Live: a CDS view's assigned tests through the generic runner
 * (`AdtExecutor.getAbapUnitTestRunner()`), named as an object target of type
 * `DDLS/DF`.
 *
 * A view holds no test class: its tests are local test classes elsewhere
 * marked `"! @testing <view>`, here in a container class's testclasses
 * include. They are assigned tests, and they execute only when the scope sets
 * `foreignTests: true`. Measured 2026-10-29 on S/4HANA 2025 and ABAP cloud,
 * with a test class of one passing and one failing method:
 *
 * - `foreignTests: true`, no preview: both executed, the failing one carries
 *   its `failedAssertion`;
 * - own tests only, no preview: an empty result — the endpoint refuses
 *   nothing;
 * - own tests only, `addForeignTestsAsPreview: true` (the library's default):
 *   both listed, no alert at all — a preview lists, it does not execute, so a
 *   failing test looks like a pass.
 *
 * Creates the view (over `I_Language`, key `Language`) and the container
 * class in the local package of its case, under fresh names, runs the three
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
  FAILING_TEST_METHOD,
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
    'runs the assigned tests with foreignTests, nothing with own tests only, and records the preview',
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

      // What this run created, and so may delete: nothing yet.
      const owned = noProbesOwned();
      let failed: { error: unknown } | undefined;
      try {
        logTestStep('create the view', testsLogger);
        await createView(client, place, owned, viewName);
        logTestStep('create the container class and its test', testsLogger);
        await createClassWithTests(
          client,
          place,
          owned,
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

        // (a) Assigned tests, no preview: both methods execute, and the
        // failing one carries its failure.
        logTestStep('run (DDLS/DF, foreignTests, no preview)', testsLogger);
        const assigned = await runToCompletion(runner, target, {
          scope: {
            ownTests: true,
            foreignTests: true,
            addForeignTestsAsPreview: false,
          },
        });
        testsLogger.info?.(
          `Run ${assigned.runId}: ${assigned.methods.join(', ')}`,
        );
        const executed = ranMethods(
          readMethodVerdicts(assigned.result).methods,
        );
        expect(executed.map((m) => `${m.testClass}.${m.name}`).sort()).toEqual([
          `LTC_VIEW.${FAILING_TEST_METHOD}`,
          `LTC_VIEW.${PROBE_TEST_METHOD}`,
        ]);
        expect(
          executed.find((m) => m.name === PROBE_TEST_METHOD)?.alerts,
        ).toEqual([]);
        expect(
          executed.find((m) => m.name === FAILING_TEST_METHOD)?.alerts,
        ).toContain('failedAssertion');

        // (b) Own tests only, no preview: a view holds none — nothing runs,
        // and the endpoint refuses nothing.
        logTestStep('run (DDLS/DF, own tests only, no preview)', testsLogger);
        const own = await runToCompletion(runner, target, {
          scope: {
            ownTests: true,
            foreignTests: false,
            addForeignTestsAsPreview: false,
          },
        });
        expect(own.methods).toEqual([]);
        expect(own.alerts).toEqual([]);

        // (c) Own tests only, with the preview (the library's default for
        // addForeignTestsAsPreview): both methods listed, nothing executed —
        // no alert on any method or on the run, FAILS_ON_PURPOSE included.
        logTestStep('run (DDLS/DF, own tests only, preview)', testsLogger);
        const preview = await runToCompletion(runner, target, {
          scope: {
            ownTests: true,
            foreignTests: false,
            addForeignTestsAsPreview: true,
          },
        });
        const previewed = {
          runId: preview.runId,
          methods: ranMethods(readMethodVerdicts(preview.result).methods),
          alerts: preview.alerts,
        };
        testsLogger.info?.(
          `Preview run (own tests only, addForeignTestsAsPreview): ${JSON.stringify(previewed)}`,
        );
        expect(
          previewed.methods.map((m) => `${m.testClass}.${m.name}`).sort(),
        ).toEqual([
          `LTC_VIEW.${FAILING_TEST_METHOD}`,
          `LTC_VIEW.${PROBE_TEST_METHOD}`,
        ]);
        expect(previewed.methods.flatMap((m) => m.alerts)).toEqual([]);
        expect(previewed.alerts).toEqual([]);
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
