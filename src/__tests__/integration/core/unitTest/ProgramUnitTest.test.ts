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
import {
  analyseActivation,
  analyseDeletion,
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
import { abapUnitRunnerDocuments } from '../../../../executors/abapUnitRunner';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { runToCompletion } from '../../../helpers/abapUnitRun';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import {
  cleanupRefusal,
  expectResult,
  raiseAfterCleanup,
  releasing,
} from '../../../helpers/contract';
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

const TITLE = "ProgramUnitTest - run a report's tests";

describe('ABAP Unit on a report (AdtClient + AdtExecutor)', () => {
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

  gate('run_program_unit_test', 'adt_program_unit_test')(
    'runs the tests of a report whose test class is in an include',
    async () => {
      const testCase = configuredCase(
        'run_program_unit_test',
        'adt_program_unit_test',
      );
      logTestStart(testsLogger, TITLE, {
        name: 'run_program_unit_test',
        params: {},
      });
      if (!testCase)
        throw new Error(
          missingCaseMessage('run_program_unit_test', 'adt_program_unit_test'),
        );
      const params = testCase.params;
      const packageName = resolvePackageName(params.package_name);
      const transportRequest = resolveTransportRequest(
        params.transport_request,
      );
      if (!packageName) throw new Error('Package name not configured');
      const expected: string[] = params.expected_test_methods ?? [];
      const skipCleanup = params.skip_cleanup === true;

      const programName: string = params.program_name;
      const includeName: string = params.include_name;
      const program = { programName };
      const include = { includeName };

      let failed: { error: unknown } | undefined;
      try {
        // Step 1: the include holding the test class
        logTestStep('create include', testsLogger);
        expectResult(
          await client.getInclude().create(
            {
              includeName,
              packageName,
              transportRequest,
              description: 'ABAP Unit test include',
            },
            { headers: integrationHeadersOf(client.getInclude(), 'create') },
          ),
          'create include',
        );
        const includeHandle = String(
          expectResult(await client.getInclude().lock(include), 'lock include'),
        );
        await releasing(
          async () =>
            expectResult(
              await client.getInclude().update(
                { ...include, transportRequest },
                {
                  headers: integrationHeadersOf(client.getInclude(), 'update'),
                  lockHandle: includeHandle,
                  source: params.include_source,
                },
              ),
              'write the test class',
            ),
          () => client.getInclude().unlock(include, includeHandle),
          'unlock after write the test class',
        );

        // Step 2: the report that pulls it in
        logTestStep('create program', testsLogger);
        expectResult(
          await client.getProgram().create(
            {
              programName,
              packageName,
              transportRequest,
              description: 'ABAP Unit test report',
            },
            { headers: integrationHeadersOf(client.getProgram(), 'create') },
          ),
          'create program',
        );
        const programHandle = String(
          expectResult(await client.getProgram().lock(program), 'lock program'),
        );
        await releasing(
          async () =>
            expectResult(
              await client.getProgram().update(
                { ...program, transportRequest },
                {
                  headers: integrationHeadersOf(client.getProgram(), 'update'),
                  lockHandle: programHandle,
                  source: params.program_source,
                },
              ),
              'write the report',
            ),
          () => client.getProgram().unlock(program, programHandle),
          'unlock after write the report',
        );

        logTestStep('activate', testsLogger);
        expectResult(
          await client.getInclude().activate(include, {
            analyse: analyseActivation,
            headers: integrationHeadersOf(client.getInclude(), 'activate'),
          }),
          'activate include',
        );
        expectResult(
          await client.getProgram().activate(program, {
            analyse: analyseActivation,
            headers: integrationHeadersOf(client.getProgram(), 'activate'),
          }),
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
        failed = { error };
        logTestError(testsLogger, TITLE, error);
      }
      // Cleanup runs whatever the body did. A refused delete fails the test;
      // when the body already failed it is added to that failure instead,
      // never replacing it. Absent — the body failed before creating it — is
      // no refusal.
      const refusals: string[] = [];
      if (!skipCleanup) {
        logTestStep('delete (cleanup)', testsLogger);
        refusals.push(
          await cleanupRefusal(
            () =>
              client.getProgram().delete(
                { ...program, transportRequest },
                {
                  analyse: analyseDeletion,
                  headers: integrationHeadersOf(client.getProgram(), 'delete'),
                },
              ),
            `delete program ${program.programName}`,
          ),
          await cleanupRefusal(
            () =>
              client.getInclude().delete(
                { ...include, transportRequest },
                {
                  analyse: analyseDeletion,
                  headers: integrationHeadersOf(client.getInclude(), 'delete'),
                },
              ),
            `delete include ${include.includeName}`,
          ),
        );
      }
      logTestEnd(testsLogger, TITLE);
      raiseAfterCleanup(failed, refusals);
    },
    getTimeout('test'),
  );
});
