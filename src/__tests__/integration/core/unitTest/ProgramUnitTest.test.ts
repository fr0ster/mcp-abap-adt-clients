/**
 * Integration test for a report's ABAP Unit tests: the report through
 * getProgram(), its test include through getInclude(), the run through
 * AdtExecutor.getProgramTestRunner().
 *
 * The test class sits in an include the report pulls in — the usual shape —
 * and the run names the report, which finds it there.
 *
 * Run: npm test -- --testPathPatterns=unitTest/ProgramUnitTest
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
import { abapUnitRunnerDocuments } from '../../../../executors/abapUnitRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { runToCompletion } from '../../../helpers/abapUnitRun';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
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
  getTestCaseDefinition,
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

const TITLE = "ProgramUnitTest - run a report's tests";

describe('ABAP Unit on a report (AdtClient + AdtExecutor)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
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
    'runs the tests of a report whose test class is in an include',
    async () => {
      const testCase = getTestCaseDefinition(
        'run_program_unit_test',
        'adt_program_unit_test',
      );
      logTestStart(testsLogger, TITLE, {
        name: 'run_program_unit_test',
        params: {},
      });
      if (!hasConfig) {
        logTestSkip(testsLogger, TITLE, 'No SAP configuration');
        return;
      }
      if (
        !testCase ||
        !TestConfigResolver.isTestAvailable(testCase, isCloudSystem, isLegacy)
      ) {
        logTestSkip(
          testsLogger,
          TITLE,
          'Test case not configured or not available for this environment',
        );
        return;
      }
      const params = testCase.params;
      const packageName = resolvePackageName(params.package_name);
      const transportRequest = resolveTransportRequest(
        params.transport_request,
      );
      if (!packageName) {
        logTestSkip(testsLogger, TITLE, 'Package name not configured');
        return;
      }
      const expected: string[] = params.expected_test_methods ?? [];
      const skipCleanup = params.skip_cleanup === true;

      const programName: string = params.program_name;
      const includeName: string = params.include_name;
      const program = { programName };
      const include = { includeName };

      try {
        // Step 1: the include holding the test class
        logTestStep('create include', testsLogger);
        expectResult(
          await client.getInclude().create({
            includeName,
            packageName,
            transportRequest,
            description: 'ABAP Unit test include',
          }),
          'create include',
        );
        const includeHandle = String(
          expectResult(await client.getInclude().lock(include), 'lock include'),
        );
        try {
          expectResult(
            await client
              .getInclude()
              .update(
                { ...include, transportRequest },
                { lockHandle: includeHandle, source: params.include_source },
              ),
            'write the test class',
          );
        } finally {
          await client.getInclude().unlock(include, includeHandle);
        }

        // Step 2: the report that pulls it in
        logTestStep('create program', testsLogger);
        expectResult(
          await client.getProgram().create({
            programName,
            packageName,
            transportRequest,
            description: 'ABAP Unit test report',
          }),
          'create program',
        );
        const programHandle = String(
          expectResult(await client.getProgram().lock(program), 'lock program'),
        );
        try {
          expectResult(
            await client
              .getProgram()
              .update(
                { ...program, transportRequest },
                { lockHandle: programHandle, source: params.program_source },
              ),
            'write the report',
          );
        } finally {
          await client.getProgram().unlock(program, programHandle);
        }

        logTestStep('activate', testsLogger);
        expectResult(
          await client.getInclude().activate(include),
          'activate include',
        );
        expectResult(
          await client.getProgram().activate(program),
          'activate program',
        );

        // Step 3: run the report's tests, by the report
        logTestStep('run (report)', testsLogger);
        const runner = new AdtExecutor(
          connection,
          libraryLogger,
        ).getProgramTestRunner({
          ...abapUnitRunnerDocuments,
          run: unitTestRunId,
        });
        const run = await runToCompletion(runner, programName);
        testsLogger.info?.(
          `Report run ${run.runId}: ${run.methods.join(', ')}`,
        );
        expect(run.methods).toEqual(expect.arrayContaining(expected));
        expect(run.alerts).toEqual([]);

        logTestSuccess(testsLogger, TITLE);
      } catch (error) {
        logTestError(testsLogger, TITLE, error);
        throw error;
      } finally {
        if (!skipCleanup) {
          logTestStep('delete (cleanup)', testsLogger);
          await client
            .getProgram()
            .delete({ ...program, transportRequest })
            .catch(() => undefined);
          await client
            .getInclude()
            .delete({ ...include, transportRequest })
            .catch(() => undefined);
        }
        logTestEnd(testsLogger, TITLE);
      }
    },
    getTimeout('test'),
  );
});
